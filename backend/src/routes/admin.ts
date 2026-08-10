import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      let query = supabaseAdmin
        .from('users')
        .select('*', { count: 'exact' });

      if (role) {
        query = query.eq('role', role);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,university_id.ilike.%${search}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;
      if (error) {
        throw new AppError(500, 'Failed to fetch users', error.message);
      }

      return res.json({
        data: data || [],
        total: count || 0,
        page: pageNum,
        limit: limitNum
      });
    } catch (err) {
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient
        .from('users')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error || !data) {
        throw new AppError(404, 'User not found');
      }

      return res.json(data);
    } catch (err) {
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;
    if (!role) throw new AppError(400, 'Role is required');

    try {
      // 1. Update public.users directly via supabaseAdmin
      const { data: updatedUser, error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', targetUserId)
        .select()
        .maybeSingle();

      // 2. If promoted to doctor, ensure record exists in public.doctors
      if (role === 'doctor' && updatedUser) {
        try {
          const docId = updatedUser.university_id || 'DOC-' + targetUserId.slice(0, 6);
          const docName = updatedUser.name?.startsWith('Dr.') ? updatedUser.name : `Dr. ${updatedUser.name || 'Medical Officer'}`;
          
          const doctorPayload: Record<string, any> = {
            user_id: targetUserId,
            doctor_id: docId,
            full_name: docName,
            email: updatedUser.email,
            department: updatedUser.department || 'Medical Center',
            specialization: updatedUser.department || 'General Medicine',
            designation: 'Consultant Physician',
            phone: updatedUser.phone || '+880 1700-000000',
            room_number: 'Room 101, Medical Center',
            available_days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            start_time: '09:00:00',
            end_time: '17:00:00',
            is_available: true,
            avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            updated_at: new Date().toISOString()
          };

          const { data: existingDoc } = await supabaseAdmin
            .from('doctors')
            .select('id')
            .or(`user_id.eq.${targetUserId},email.eq.${updatedUser.email}`)
            .maybeSingle();

          if (existingDoc?.id) {
            await supabaseAdmin
              .from('doctors')
              .update(doctorPayload)
              .eq('id', existingDoc.id);
          } else {
            await supabaseAdmin
              .from('doctors')
              .insert([doctorPayload]);
          }
        } catch (docSaveErr) {
          console.warn('[Admin Role Update Doctor Sync Warning]:', docSaveErr);
        }
      }

      // 3. Also invoke RPC if defined (for any database triggers)
      try {
        const authClient = createAuthClient(req.token!);
        await authClient.rpc('update_user_role', {
          p_user_id: targetUserId,
          p_role: role
        });
      } catch (rpcErr) {
        // Non-fatal if direct update succeeded
      }

      // 4. Audit Log
      try {
        await supabaseAdmin.from('admin_audit_logs').insert({
          actor_id: req.user!.id,
          action: 'user_role_updated',
          target_user_id: targetUserId,
          metadata: { new_role: role }
        });
      } catch (auditErr) {}

      return res.json({
        success: true,
        data: updatedUser || { id: targetUserId, role }
      });
    } catch (err) {
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users - Admin create user with direct credentials
router.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { email, password, name, university_id, department, phone, role = 'student_faculty' } = req.body;

    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanName = (name || '').trim();
    const cleanUniId = (university_id || '').trim();

    if (!cleanEmail || !password || !cleanName) {
      throw new AppError(400, 'Email, password, and full name are required.');
    }

    // 1. Create or fetch Auth user
    let userId: string = '';
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: { name: cleanName }
    });

    if (authErr) {
      // Check if user already exists
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
      if (existing) {
        userId = existing.id;
      } else {
        throw new AppError(400, 'Auth creation failed: ' + authErr.message);
      }
    } else if (authData.user) {
      userId = authData.user.id;
    }

    // 2. Upsert public.users profile
    const { data: userProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: cleanEmail,
        name: cleanName,
        university_id: cleanUniId || 'ID-' + Math.floor(1000 + Math.random() * 9000),
        department: department || 'General',
        phone: phone || null,
        role: role,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (profileErr) {
      console.warn('[Admin Create User Profile Error]:', profileErr);
    }

    // 3. If doctor, create public.doctors entry
    if (role === 'doctor') {
      try {
        const docPayload: Record<string, any> = {
          user_id: userId,
          doctor_id: cleanUniId || 'DOC-' + Math.floor(1000 + Math.random() * 9000),
          full_name: cleanName.startsWith('Dr.') ? cleanName : `Dr. ${cleanName}`,
          email: cleanEmail,
          department: department || 'Medical Center',
          specialization: department || 'General Medicine',
          designation: 'Consultant Physician',
          phone: phone || '+880 1700-000000',
          room_number: 'Room 101, Medical Center',
          available_days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
          start_time: '09:00:00',
          end_time: '17:00:00',
          is_available: true,
          avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
          updated_at: new Date().toISOString()
        };

        await supabaseAdmin.from('doctors').upsert(docPayload, { onConflict: 'email' });
      } catch (docErr) {
        console.warn('[Admin Create User Doctor Table Insert Warning]:', docErr);
      }
    }

    return res.status(201).json({
      success: true,
      data: userProfile || { id: userId, email: cleanEmail, name: cleanName, role }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) throw new AppError(400, 'Status is required');

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('update_user_status', {
        p_user_id: req.params.id,
        p_status: status
      });

      if (error) {
        throw new AppError(500, 'Failed to update user status', error.message);
      }

      return res.json(data);
    } catch (err) {
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats
router.get('/stats', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    try {
      const [
        { count: total_users },
        { count: students_faculty },
        { count: doctors },
        { count: emergency_admins },
        { count: super_admins },
        { count: active_users },
        { count: suspended_users },
        { count: pending_doctor_requests },
        { count: active_sos_alerts },
        { count: today_appointments },
        { count: today_incidents },
        { count: total_broadcasts },
        { count: total_health_records }
      ] = await Promise.all([
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student_faculty'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'emergency_admin'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'super_admin'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
        supabaseAdmin.from('doctor_access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseAdmin.from('sos_alerts').select('*', { count: 'exact', head: true }).in('status', ['active', 'acknowledged']),
        supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', new Date().toISOString().split('T')[0]),
        supabaseAdmin.from('incident_reports').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z'),
        supabaseAdmin.from('broadcasts').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('health_records').select('*', { count: 'exact', head: true })
      ]);

      const data = {
        total_users: total_users || 0,
        students_faculty: students_faculty || 0,
        doctors: doctors || 0,
        emergency_admins: emergency_admins || 0,
        super_admins: super_admins || 0,
        active_users: active_users || 0,
        suspended_users: suspended_users || 0,
        disabled_users: 0,
        pending_doctor_requests: pending_doctor_requests || 0,
        active_sos_alerts: active_sos_alerts || 0,
        today_appointments: today_appointments || 0,
        today_incidents: today_incidents || 0,
        unread_notifications: 0,
        total_broadcasts: total_broadcasts || 0,
        total_health_records: total_health_records || 0
      };

      return res.json(data);
    } catch (err) {
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

export default router;

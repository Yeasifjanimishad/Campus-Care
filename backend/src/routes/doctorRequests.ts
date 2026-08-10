import { Router } from 'express';
import { supabaseAdmin, createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { publicEndpointLimiter } from '../middleware/rateLimiter.js';
import { validateBody, createDoctorRequestSchema } from '../middleware/validator.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/doctor-requests/check-duplicate
router.get('/check-duplicate', async (req, res, next) => {
  try {
    const { email, doctor_id } = req.query;
    if (!email || !doctor_id) {
      throw new AppError(400, 'Missing email or doctor_id');
    }

    const cleanEmail = email.toString().toLowerCase().trim();
    const cleanDocId = doctor_id.toString().trim();

    try {
      const { data: pendingData } = await supabaseAdmin
        .from('doctor_access_requests')
        .select('id')
        .eq('status', 'pending')
        .or(`email.eq.${cleanEmail},doctor_id.eq.${cleanDocId}`);

      const { data: approvedData } = await supabaseAdmin
        .from('doctor_access_requests')
        .select('id')
        .eq('status', 'approved')
        .or(`email.eq.${cleanEmail},doctor_id.eq.${cleanDocId}`);

      const existsPending = pendingData && pendingData.length > 0;
      const existsApproved = approvedData && approvedData.length > 0;

      return res.json([{ exists_pending: !!existsPending, exists_approved: !!existsApproved }]);
    } catch (dbErr) {
      console.warn('[Doctor Requests check-duplicate]: DB query failed, returning non-duplicate fallback:', dbErr);
      return res.json([{ exists_pending: false, exists_approved: false }]);
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests
router.post('/', publicEndpointLimiter, validateBody(createDoctorRequestSchema), async (req, res, next) => {
  try {
    const { full_name, email, doctor_id, department, phone, message } = req.body;

    const cleanEmail = email.toLowerCase().trim();
    const cleanDocId = doctor_id.trim();
    const cleanName = full_name.trim();

    try {
      // 1. Check for existing pending request
      const { data: pendingData, error: pendingError } = await supabaseAdmin
        .from('doctor_access_requests')
        .select('id')
        .eq('status', 'pending')
        .or(`email.eq.${cleanEmail},doctor_id.eq.${cleanDocId}`);

      if (!pendingError && pendingData && pendingData.length > 0) {
        throw new AppError(400, 'A pending access request already exists for this email or Doctor ID.');
      }

      // 2. Check for existing approved request
      const { data: approvedData, error: approvedError } = await supabaseAdmin
        .from('doctor_access_requests')
        .select('id')
        .eq('status', 'approved')
        .or(`email.eq.${cleanEmail},doctor_id.eq.${cleanDocId}`);

      if (!approvedError && approvedData && approvedData.length > 0) {
        throw new AppError(400, 'An approved doctor record already exists for this email or Doctor ID.');
      }

      // 3. Insert new request
      const { data, error } = await supabaseAdmin
        .from('doctor_access_requests')
        .insert([
          {
            full_name: cleanName,
            email: cleanEmail,
            doctor_id: cleanDocId,
            department: department ? department.trim() : null,
            phone: phone ? phone.trim() : null,
            message: message ? message.trim() : null
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('[Doctor Requests insert error]:', error);
        throw new AppError(500, 'Failed to submit doctor request: ' + error.message);
      }

      return res.status(201).json({ success: true, data });
    } catch (dbErr: any) {
      if (dbErr instanceof AppError) throw dbErr;
      console.error('[Doctor Requests submission exception]:', dbErr);
      throw new AppError(500, dbErr?.message || 'Database error processing doctor request');
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/doctor-requests
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('doctor_access_requests')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.warn('[Doctor Requests GET error]:', error.message);
      return res.json({
        data: [],
        total: 0,
        page: pageNum,
        limit: limitNum
      });
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
});

// Helper function to generate a secure, readable temporary password
const generateTempPassword = (prefix: string = 'Doc@2026!'): string => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${rand}`;
};

// POST /api/doctor-requests/:id/approve
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const customPassword = req.body?.tempPassword?.trim();

    // 1. Fetch the pending request using supabaseAdmin
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('doctor_access_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new AppError(404, 'Request not found: ' + (fetchError?.message || 'Invalid ID'));
    }

    let userId: string = '';
    const tempPassword = customPassword || generateTempPassword();
    let isNewUser = false;
    const cleanEmail = request.email.toLowerCase().trim();

    // 2. Check if user profile already exists in public.users
    const { data: existingProfiles } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', cleanEmail);

    if (existingProfiles && existingProfiles.length > 0) {
      userId = existingProfiles[0].id;
      
      // Update their profile to 'doctor' role
      await supabaseAdmin
        .from('users')
        .update({
          role: 'doctor',
          name: request.full_name,
          university_id: request.doctor_id,
          department: request.department || 'Medical Center',
          phone: request.phone || null,
          status: 'active'
        })
        .eq('id', userId);

      // Also reset/update their Auth password so the admin has the guaranteed password to give
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: request.full_name }
        });
      } catch (authUpdateErr) {
        console.warn('[Doctor Approval Auth Update Notice]:', authUpdateErr);
      }
    } else {
      // Check if user already exists in auth.users
      let existingAuthId: string | null = null;
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const found = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
        if (found) {
          existingAuthId = found.id;
        }
      } catch (listErr) {
        console.warn('[Doctor Approval listUsers Warning]:', listErr);
      }

      if (existingAuthId) {
        userId = existingAuthId;
        // Update password for existing auth account
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: request.full_name }
        });
      } else {
        // Create a new Auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: request.full_name }
        });

        if (authError || !authData.user) {
          throw new AppError(500, 'Failed to create auth credentials for doctor: ' + (authError?.message || 'Unknown error'));
        }
        
        userId = authData.user.id;
        isNewUser = true;
      }

      // Upsert into public.users
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: userId,
          email: cleanEmail,
          name: request.full_name,
          university_id: request.doctor_id,
          role: 'doctor',
          department: request.department || 'Medical Center',
          phone: request.phone || null,
          status: 'active'
        });
        
      if (profileError) {
        console.warn('[Doctor Approval profile upsert warning]:', profileError.message);
      }
    }

    // 3. Mark request as approved
    await supabaseAdmin
      .from('doctor_access_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user!.id
      })
      .eq('id', id);

    // 4. Create or update doctor catalog record in public.doctors
    try {
      const { data: existingDoctor } = await supabaseAdmin
        .from('doctors')
        .select('id')
        .or(`doctor_id.eq.${request.doctor_id},email.eq.${cleanEmail}`)
        .maybeSingle();
        
      const doctorPayload: Record<string, any> = {
        doctor_id: request.doctor_id,
        full_name: request.full_name.startsWith('Dr.') ? request.full_name : `Dr. ${request.full_name}`,
        email: cleanEmail,
        department: request.department || 'Medical Center',
        specialization: request.department || 'General Medicine',
        designation: 'Consultant Physician',
        phone: request.phone || '+880 1700-000000',
        room_number: 'Room 101, Medical Center',
        available_days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        start_time: '09:00:00',
        end_time: '17:00:00',
        is_available: true,
        avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
        updated_at: new Date().toISOString()
      };

      if (userId) {
        doctorPayload.user_id = userId;
      }

      if (existingDoctor?.id) {
        await supabaseAdmin
          .from('doctors')
          .update(doctorPayload)
          .eq('id', existingDoctor.id);
      } else {
        const { error: docInsertErr } = await supabaseAdmin
          .from('doctors')
          .insert([doctorPayload]);

        if (docInsertErr) {
          console.warn('[Doctor Catalog Insert Warning - Retrying with minimal payload]:', docInsertErr.message);
          // Fallback minimal insert with exact columns
          await supabaseAdmin
            .from('doctors')
            .insert([{
              user_id: userId || null,
              doctor_id: request.doctor_id,
              full_name: request.full_name,
              email: cleanEmail,
              department: request.department || 'Medical Center',
              is_available: true
            }]);
        }
      }
    } catch (docTableErr) {
      console.warn('[Doctor Catalog Upsert Exception]:', docTableErr);
    }

    // 5. Add Audit Log
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          actor_id: req.user!.id,
          action: 'doctor_approved',
          target_user_id: userId,
          metadata: {
            doctor_id: request.doctor_id,
            email: cleanEmail,
            full_name: request.full_name,
            department: request.department
          }
        });
    } catch (auditErr) {
      console.warn('[Audit Log Insert Warning]:', auditErr);
    }

    return res.json({
      success: true,
      message: `Doctor Dr. ${request.full_name} approved and activated successfully.`,
      tempPassword: tempPassword,
      isNewUser: isNewUser,
      doctorName: request.full_name,
      email: cleanEmail,
      doctorId: request.doctor_id,
      department: request.department || 'Medical Center'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests/:id/reset-password
router.post('/:id/reset-password', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('doctor_access_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new AppError(404, 'Doctor access request not found');
    }

    const cleanEmail = request.email.toLowerCase().trim();
    const newPassword = generateTempPassword();

    // Look up user id
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (!userData?.id) {
      throw new AppError(404, 'No active user account found for this doctor email');
    }

    await supabaseAdmin.auth.admin.updateUserById(userData.id, {
      password: newPassword,
      email_confirm: true
    });

    return res.json({
      success: true,
      message: 'Password reset successfully',
      tempPassword: newPassword,
      doctorName: request.full_name,
      email: cleanEmail,
      doctorId: request.doctor_id,
      department: request.department || 'Medical Center'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests/:id/reject
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { review_note } = req.body;

    // 1. Fetch the pending request
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('doctor_access_requests')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !request) {
      throw new AppError(404, 'Request not found or is no longer pending', fetchError?.message);
    }

    // 2. Mark request as rejected
    const { error: updateError } = await supabaseAdmin
      .from('doctor_access_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user!.id,
        review_note: review_note || 'Access request rejected by university administration.'
      })
      .eq('id', id);

    if (updateError) {
      throw new AppError(500, 'Failed to reject request', updateError.message);
    }

    // 3. Add Audit Log
    try {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', request.email.toLowerCase());

      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          actor_id: req.user!.id,
          action: 'doctor_rejected',
          target_user_id: (existingUser && existingUser.length > 0) ? existingUser[0].id : null,
          metadata: {
            doctor_id: request.doctor_id,
            email: request.email,
            full_name: request.full_name,
            review_note: review_note || null
          }
        });
    } catch (auditErr) {
      console.warn('[Audit Log Rejection Warning]:', auditErr);
    }

    return res.json({
      success: true,
      message: 'Doctor request rejected successfully.'
    });
  } catch (err) {
    next(err);
  }
});

export default router;

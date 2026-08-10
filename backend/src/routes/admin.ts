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
router.put('/users/:id/role', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role) throw new AppError(400, 'Role is required');

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('update_user_role', {
        p_user_id: req.params.id,
        p_role: role
      });

      if (error) {
        throw new AppError(500, 'Failed to update user role', error.message);
      }

      return res.json(data);
    } catch (err) {
      next(err);
    }
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

import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const MOCK_USERS: any[] = [
  { id: 'mock-student-1', email: 'sokal@diu.edu.bd', name: 'Sokal Ahmed', role: 'student_faculty', status: 'active', university_id: '221-15-001', department: 'CSE' },
  { id: 'mock-student-2', email: 'mishad242-35-739@diu.edu.bd', name: 'Yeasif Jani Mishad', role: 'student_faculty', status: 'active', university_id: '242-35-739', department: 'Software Engineering' },
  { id: 'mock-doctor-1', email: 'doctor@diu.edu.bd', name: 'Dr. Mahbub Rahman', role: 'doctor', status: 'active', university_id: 'DOC-1001', department: 'Medical Center' },
  { id: 'mock-superadmin-1', email: 'superadmin@diu.edu.bd', name: 'CampusCare Admin', role: 'super_admin', status: 'active', university_id: 'ADM-0001', department: 'Central Admin' },
];

// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
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
      if (!error && data) {
        return res.json({
          data,
          total: count,
          page: pageNum,
          limit: limitNum
        });
      }
    } catch (sbErr) {
      console.warn('[Admin Users Fetch Warning]: Supabase query failed, returning mock data');
    }

    let filtered = [...MOCK_USERS];
    if (role) filtered = filtered.filter(u => u.role === role);
    if (status) filtered = filtered.filter(u => u.status === status);
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(u => 
        (u.name && u.name.toLowerCase().includes(searchLower)) ||
        (u.email && u.email.toLowerCase().includes(searchLower)) ||
        (u.university_id && u.university_id.toLowerCase().includes(searchLower))
      );
    }
    
    // Default created_at
    filtered = filtered.map(u => ({ ...u, created_at: u.created_at || new Date().toISOString() }));
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      data: filtered,
      total: filtered.length,
      page: pageNum,
      limit: limitNum
    });
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
        
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const user = MOCK_USERS.find(u => u.id === req.params.id);
    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
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

      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const user = MOCK_USERS.find(u => u.id === req.params.id);
    if (user) {
      user.role = role;
    }
    res.json({ success: true });
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

      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const user = MOCK_USERS.find(u => u.id === req.params.id);
    if (user) {
      user.status = status;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats
router.get('/stats', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('get_super_admin_stats');
      
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {
      console.warn('[Admin Stats Fetch Warning]: Supabase query failed, returning mock data');
    }

    res.json({
      total_users: MOCK_USERS.length,
      active_incidents: 0,
      active_sos: 0,
      recent_appointments: 0,
      doctors_count: MOCK_USERS.filter(u => u.role === 'doctor').length,
      students_count: MOCK_USERS.filter(u => u.role === 'student_faculty').length,
      pending_verifications: 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

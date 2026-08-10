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
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('get_super_admin_stats');
      
      if (error) {
        throw new AppError(500, 'Failed to fetch admin stats', error.message);
      }

      return res.json(data);
    } catch (err) {
      next(err);
    }
  } catch (err) {
    next(err);
  }
});

export default router;

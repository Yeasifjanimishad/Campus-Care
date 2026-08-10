import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/admin/audit-logs
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { action, actor_id, target_user_id, start_date, end_date, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
        .from('admin_audit_logs')
        .select(`
          *,
          actor:users!admin_audit_logs_actor_id_fkey(name, email, role),
          target_user:users!admin_audit_logs_target_user_id_fkey(name, email, role)
        `, { count: 'exact' });

      if (action) query = query.eq('action', action);
      if (actor_id) query = query.eq('actor_id', actor_id);
      if (target_user_id) query = query.eq('target_user_id', target_user_id);
      if (start_date) query = query.gte('created_at', start_date);
      if (end_date) query = query.lte('created_at', end_date);

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;
      
      if (error) {
        throw new Error(error.message || 'Failed to fetch audit logs');
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

export default router;

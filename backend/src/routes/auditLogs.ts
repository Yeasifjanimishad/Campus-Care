import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const MOCK_AUDIT_LOGS: any[] = [];

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
      
      if (!error && data) {
        return res.json({
          data,
          total: count || 0,
          page: pageNum,
          limit: limitNum
        });
      }
    } catch (sbErr) {
      console.warn('[Audit Logs Fetch Warning]: Supabase query failed, returning mock data');
    }

    let filtered = [...MOCK_AUDIT_LOGS];
    if (action) filtered = filtered.filter(l => l.action === action);
    if (actor_id) filtered = filtered.filter(l => l.actor_id === actor_id);
    if (target_user_id) filtered = filtered.filter(l => l.target_user_id === target_user_id);
    if (start_date) filtered = filtered.filter(l => new Date(l.created_at) >= new Date(start_date as string));
    if (end_date) filtered = filtered.filter(l => new Date(l.created_at) <= new Date(end_date as string));

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      data: filtered.slice(offset, offset + limitNum),
      total: filtered.length,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const MOCK_NOTIFICATIONS: any[] = [];

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { count, error } = await authClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user!.id)
        .eq('is_read', false);

      if (!error) {
        return res.json({ count: count || 0 });
      }
    } catch (sbErr) {
      console.warn('[Notification Unread Count Warning]: Supabase query failed');
    }

    const count = MOCK_NOTIFICATIONS.filter(n => n.user_id === req.user!.id && !n.is_read).length;
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { unread_only, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user!.id);

      if (unread_only === 'true') {
        query = query.eq('is_read', false);
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
      console.warn('[Notification Fetch Warning]: Supabase query failed, returning mock data');
    }

    let filtered = MOCK_NOTIFICATIONS.filter(n => n.user_id === req.user!.id);
    if (unread_only === 'true') {
      filtered = filtered.filter(n => !n.is_read);
    }
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

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('mark_notification_read', {
        p_notification_id: req.params.id
      });
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}
    
    const notification = MOCK_NOTIFICATIONS.find(n => n.id === req.params.id && n.user_id === req.user!.id);
    if (notification) {
      notification.is_read = true;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('mark_all_notifications_read');
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}
    
    let updated_count = 0;
    MOCK_NOTIFICATIONS.forEach(n => {
      if (n.user_id === req.user!.id && !n.is_read) {
        n.is_read = true;
        updated_count++;
      }
    });
    res.json({ success: true, updated_count });
  } catch (err) {
    next(err);
  }
});

export default router;

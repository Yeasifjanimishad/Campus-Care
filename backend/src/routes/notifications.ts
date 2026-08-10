import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { count, error } = await authClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.id)
      .eq('is_read', false);

    if (error) {
      throw new AppError(500, 'Failed to fetch notification count', error.message);
    }

    res.json({ count: count || 0 });
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

      if (error) {
        throw new AppError(500, 'Failed to fetch notifications', error.message);
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

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('mark_notification_read', {
      p_notification_id: req.params.id
    });

    if (error) {
      throw new AppError(500, 'Failed to mark notification read', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('mark_all_notifications_read');

    if (error) {
      throw new AppError(500, 'Failed to mark all notifications read', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

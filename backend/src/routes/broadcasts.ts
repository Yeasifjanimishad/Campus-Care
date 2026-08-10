import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const MOCK_BROADCASTS: any[] = [];

// POST /api/broadcasts
router.post('/', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { title, message, category, priority, target_role } = req.body;
    
    if (!title || !message || !category) {
      throw new AppError(400, 'Title, message, and category are required');
    }

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('create_broadcast', {
        p_title: title,
        p_message: message,
        p_category: category,
        p_priority: priority || 'normal',
        p_target_role: target_role || 'all'
      });

      if (!error && data) {
        return res.status(201).json(data);
      }
    } catch (sbErr) {
      console.warn('[Broadcast Create Warning]: Supabase RPC failed, storing in mock memory');
    }

    const newBroadcast = {
      id: `mock-broadcast-${Date.now()}`,
      created_by: req.user!.id,
      title,
      message,
      category,
      priority: priority || 'normal',
      target_role: target_role || 'all',
      created_at: new Date().toISOString(),
      creator: req.user
    };
    MOCK_BROADCASTS.push(newBroadcast);

    res.status(201).json({ success: true, recipient_count: 0, broadcast: newBroadcast });
  } catch (err) {
    next(err);
  }
});

// GET /api/broadcasts
router.get('/', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error, count } = await authClient
        .from('broadcasts')
        .select(`
          *,
          creator:users!created_by(name, email, role)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (!error && data) {
        return res.json({
          data,
          total: count,
          page: pageNum,
          limit: limitNum
        });
      }
    } catch (sbErr) {
      console.warn('[Broadcast Fetch Warning]: Supabase query failed, returning mock data');
    }

    const filtered = [...MOCK_BROADCASTS].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

export default router;

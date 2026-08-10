import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// POST /api/broadcasts
router.post('/', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { title, message, category, priority, target_role } = req.body;

    if (!title || !message || !category) {
      throw new AppError(400, 'Title, message, and category are required');
    }

    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('create_broadcast', {
      p_title: title,
      p_message: message,
      p_category: category,
      p_priority: priority || 'normal',
      p_target_role: target_role || 'all'
    });

    if (error) {
      throw new AppError(500, 'Failed to create broadcast', error.message);
    }

    return res.status(201).json(data);
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

    const authClient = createAuthClient(req.token!);
    const { data, error, count } = await authClient
      .from('broadcasts')
      .select(`
        *,
        creator:users!created_by(name, email, role)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      throw new AppError(500, 'Failed to fetch broadcasts', error.message);
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

export default router;

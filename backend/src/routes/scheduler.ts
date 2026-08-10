import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { executeSchedulerCycle, getSchedulerStatus } from '../services/scheduler.js';

const router = Router();

// GET /api/admin/scheduler/health
router.get('/health', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('get_scheduler_health');
    if (error) {
      throw new Error(error.message || 'Failed to retrieve scheduler health');
    }

    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/scheduler/logs
router.get('/logs', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error, count } = await authClient
        .from('scheduler_logs')
        .select('*', { count: 'exact' })
        .order('executed_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (error) {
        throw new Error(error.message || 'Failed to fetch scheduler logs');
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

// POST /api/admin/scheduler/run
router.post('/run', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const cycleResult = await executeSchedulerCycle();

    res.json({
      success: true,
      result: {
        message: `Scheduled tasks cycle executed successfully (${cycleResult?.mode || 'standard'}).`,
        ...cycleResult
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

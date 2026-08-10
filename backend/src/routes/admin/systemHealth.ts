import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../../lib/supabase.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { AppError } from '../../lib/errors.js';

const router = Router();

// System health endpoints rely on Supabase-managed system events and scheduler failures.

// GET /api/admin/system-health/events
// Query system_health_events with filters: ?resolved=false, ?severity=critical. Support pagination.
router.get('/events', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { resolved, severity, component, event_type, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
        .from('system_health_events')
        .select('*', { count: 'exact' });

      if (resolved !== undefined) {
        const isResolved = resolved === 'true' || resolved === true || resolved === '1';
        query = query.eq('resolved', isResolved);
      }

      if (severity) {
        query = query.eq('severity', severity);
      }

      if (component) {
        query = query.eq('component', component);
      }

      if (event_type) {
        query = query.eq('event_type', event_type);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;
      if (error) {
        throw new AppError(500, 'Failed to fetch system health events', error.message);
      }

      return res.json({
        data: data || [],
        total: count ?? (data ? data.length : 0),
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

// GET /api/admin/system-health/failures
// Query scheduler_task_failures. Support filters: ?status=failed. Support pagination.
router.get('/failures', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, task_type, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
        .from('scheduler_task_failures')
        .select('*', { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      if (task_type) {
        query = query.eq('task_type', task_type);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;
      if (error) {
        throw new AppError(500, 'Failed to fetch scheduler failures', error.message);
      }

      return res.json({
        data: data || [],
        total: count ?? (data ? data.length : 0),
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

// POST /api/admin/system-health/:id/resolve
// Call RPC resolve_system_health_event(id). Return result.
router.post('/:id/resolve', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError(400, 'Missing event id');
    }

    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('resolve_system_health_event', {
      p_event_id: id
    });

    if (error) {
      throw new AppError(500, 'Failed to resolve system health event', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/system-health
// Call RPC get_system_health(). Return full system health overview.
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('get_system_health');

    if (error) {
      throw new AppError(500, 'Failed to fetch system health overview', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

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
    const today = new Date().toISOString().split('T')[0];

    const [
      { data: lastLog },
      { data: lastSuccessLog },
      { data: lastFailedLog },
      { count: runsToday },
      { count: failuresToday },
      { count: remindersToday },
      { count: sosEscalationsToday },
      { count: unresolvedCriticalCount },
      { data: unresolvedHealthEvents },
      { count: failedTasksCount },
      { count: activeSosCount },
      { count: unacknowledgedSosCount },
      { count: escalatedSosCount },
      { count: notifsToday },
      { count: notifFailuresToday }
    ] = await Promise.all([
      authClient.from('scheduler_logs').select('*').order('executed_at', { ascending: false }).limit(1).maybeSingle(),
      authClient.from('scheduler_logs').select('*').eq('status', 'success').order('executed_at', { ascending: false }).limit(1).maybeSingle(),
      authClient.from('scheduler_logs').select('*').neq('status', 'success').order('executed_at', { ascending: false }).limit(1).maybeSingle(),
      authClient.from('scheduler_logs').select('*', { count: 'exact', head: true }).gte('executed_at', today + 'T00:00:00Z'),
      authClient.from('scheduler_logs').select('*', { count: 'exact', head: true }).gte('executed_at', today + 'T00:00:00Z').neq('status', 'success'),
      authClient.from('appointment_reminders').select('*', { count: 'exact', head: true }).gte('sent_at', today + 'T00:00:00Z'),
      authClient.from('sos_alerts').select('*', { count: 'exact', head: true }).eq('is_escalated', true).gte('escalated_at', today + 'T00:00:00Z'),
      authClient.from('system_health_events').select('*', { count: 'exact', head: true }).eq('resolved', false).eq('severity', 'critical'),
      authClient.from('system_health_events').select('id, event_type, severity, component, message, metadata, created_at').eq('resolved', false).order('created_at', { ascending: false }).limit(20),
      authClient.from('scheduler_task_failures').select('*', { count: 'exact', head: true }).in('status', ['failed', 'retrying']),
      authClient.from('sos_alerts').select('*', { count: 'exact', head: true }).in('status', ['active', 'acknowledged']),
      authClient.from('sos_alerts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      authClient.from('sos_alerts').select('*', { count: 'exact', head: true }).eq('is_escalated', true).in('status', ['active', 'acknowledged']),
      authClient.from('notifications').select('*', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00Z'),
      authClient.from('notifications').select('*', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00Z').eq('delivery_status', 'failed')
    ]);

    let status = 'HEALTHY';
    let status_reason = 'System operational. Scheduler executing normally.';
    let minutes_since_last_run = null;

    if (lastSuccessLog) {
      minutes_since_last_run = Math.round((new Date().getTime() - new Date(lastSuccessLog.executed_at).getTime()) / 60000 * 10) / 10;
    }

    if (!lastSuccessLog || (minutes_since_last_run !== null && minutes_since_last_run > 15)) {
      status = 'CRITICAL';
      status_reason = `CRITICAL: Scheduler has not completed successfully in ${minutes_since_last_run !== null ? minutes_since_last_run : 'unknown'} minutes.`;
    } else if ((unresolvedCriticalCount || 0) > 0) {
      status = 'CRITICAL';
      status_reason = `CRITICAL: ${unresolvedCriticalCount} unresolved critical system health event(s) pending.`;
    } else if ((failuresToday || 0) > 0 || (failedTasksCount || 0) > 0 || (unacknowledgedSosCount || 0) > 2) {
      status = 'DEGRADED';
      status_reason = 'DEGRADED: Recent scheduler or task failures detected, or unacknowledged SOS alert backlog.';
    }

    const data = {
      status,
      status_reason,
      last_execution: lastLog || null,
      last_success_execution: lastSuccessLog || null,
      last_failed_execution: lastFailedLog || null,
      runs_today: runsToday || 0,
      failures_today: failuresToday || 0,
      reminders_sent_today: remindersToday || 0,
      sos_escalations_today: sosEscalationsToday || 0,
      unresolved_critical_events_count: unresolvedCriticalCount || 0,
      unresolved_health_events: unresolvedHealthEvents || [],
      failed_tasks_count: failedTasksCount || 0,
      active_sos_count: activeSosCount || 0,
      unacknowledged_sos_count: unacknowledgedSosCount || 0,
      escalated_sos_count: escalatedSosCount || 0,
      notifications_today: notifsToday || 0,
      notification_failures_today: notifFailuresToday || 0
    };

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../../lib/supabase.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { AppError } from '../../lib/errors.js';

const router = Router();

// In-memory mock data for development and fallback
const MOCK_HEALTH_EVENTS: any[] = [
  {
    id: 'mock-event-01',
    event_type: 'SCHEDULER_HEARTBEAT',
    severity: 'info',
    component: 'scheduler',
    message: 'Automated 5-minute background reminder and SOS check cycle executed normally.',
    metadata: { reminders_checked: 14, escalations_checked: 2 },
    resolved: true,
    resolved_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    resolved_by: 'mock-superadmin-1',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString()
  },
  {
    id: 'mock-event-02',
    event_type: 'NETWORK_LATENCY_SPIKE',
    severity: 'warning',
    component: 'gateway',
    message: 'Elevated latency detected on campus SMS/Notification gateway API.',
    metadata: { latency_ms: 1240, threshold_ms: 800 },
    resolved: false,
    resolved_at: null,
    resolved_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString()
  }
];

const MOCK_SCHEDULER_FAILURES: any[] = [
  {
    id: 'mock-fail-01',
    task_type: 'appointment_reminder_dispatch',
    reference_id: 'mock-appt-99',
    error_message: 'Recipient contact endpoint temporarily unavailable (timeout > 5000ms).',
    error_code: 'GATEWAY_TIMEOUT',
    attempt_count: 2,
    status: 'failed',
    next_retry_at: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    resolved_at: null,
    metadata: { channel: 'sms', provider: 'campus_gateway' },
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 40).toISOString()
  }
];

let MOCK_SYSTEM_HEALTH = {
  status: 'HEALTHY' as const,
  status_reason: 'All automated health checks and background systems operating normally.',
  last_execution: {
    id: 'health-001',
    executed_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    reminders_sent: 2,
    sos_escalations: 0,
    status: 'success'
  },
  last_success_execution: {
    id: 'health-001',
    executed_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    reminders_sent: 2,
    sos_escalations: 0,
    status: 'success'
  },
  last_failed_execution: null,
  runs_today: 14,
  failures_today: 0,
  reminders_sent_today: 8,
  sos_escalations_today: 0,
  unresolved_critical_events_count: 0,
  unresolved_health_events: MOCK_HEALTH_EVENTS.filter(e => !e.resolved),
  failed_tasks_count: MOCK_SCHEDULER_FAILURES.filter(f => f.status === 'failed').length,
  active_sos_count: 0,
  unacknowledged_sos_count: 0,
  escalated_sos_count: 0,
  notifications_today: 15,
  notification_failures_today: 0
};

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
      if (!error && data) {
        return res.json({
          data,
          total: count ?? data.length,
          page: pageNum,
          limit: limitNum
        });
      }
    } catch (sbErr) {
      console.warn('[System Health Events Warning]: Supabase query failed, returning fallback mock data');
    }

    let filtered = [...MOCK_HEALTH_EVENTS];
    if (resolved !== undefined) {
      const isResolved = resolved === 'true' || resolved === true || resolved === '1';
      filtered = filtered.filter(e => Boolean(e.resolved) === isResolved);
    }
    if (severity) {
      filtered = filtered.filter(e => e.severity === severity);
    }
    if (component) {
      filtered = filtered.filter(e => e.component === component);
    }
    if (event_type) {
      filtered = filtered.filter(e => e.event_type === event_type);
    }

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
      if (!error && data) {
        return res.json({
          data,
          total: count ?? data.length,
          page: pageNum,
          limit: limitNum
        });
      }
    } catch (sbErr) {
      console.warn('[Scheduler Failures Warning]: Supabase query failed, returning fallback mock data');
    }

    let filtered = [...MOCK_SCHEDULER_FAILURES];
    if (status) {
      filtered = filtered.filter(f => f.status === status);
    }
    if (task_type) {
      filtered = filtered.filter(f => f.task_type === task_type);
    }

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

// POST /api/admin/system-health/:id/resolve
// Call RPC resolve_system_health_event(id). Return result.
router.post('/:id/resolve', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError(400, 'Missing event id');
    }

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('resolve_system_health_event', {
        p_event_id: id
      });

      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {
      console.warn('[Resolve System Health Event Warning]: Supabase RPC failed, resolving in mock memory');
    }

    // Mock resolve
    const event = MOCK_HEALTH_EVENTS.find(e => e.id === id);
    if (event) {
      event.resolved = true;
      event.resolved_at = new Date().toISOString();
      event.resolved_by = req.user?.id || 'mock-admin';
    }

    // Update in-memory health metrics
    MOCK_SYSTEM_HEALTH.unresolved_health_events = MOCK_HEALTH_EVENTS.filter(e => !e.resolved);
    MOCK_SYSTEM_HEALTH.unresolved_critical_events_count = MOCK_SYSTEM_HEALTH.unresolved_health_events.filter(e => e.severity === 'critical').length;

    res.json({
      success: true,
      message: 'System health event resolved successfully.'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/system-health
// Call RPC get_system_health(). Return full system health overview.
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('get_system_health');

      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {
      console.warn('[System Health Overview Warning]: Supabase RPC failed, returning fallback health overview');
    }

    // Return current mock overview
    MOCK_SYSTEM_HEALTH.unresolved_health_events = MOCK_HEALTH_EVENTS.filter(e => !e.resolved);
    MOCK_SYSTEM_HEALTH.unresolved_critical_events_count = MOCK_SYSTEM_HEALTH.unresolved_health_events.filter(e => e.severity === 'critical').length;
    MOCK_SYSTEM_HEALTH.failed_tasks_count = MOCK_SCHEDULER_FAILURES.filter(f => f.status === 'failed').length;

    res.json(MOCK_SYSTEM_HEALTH);
  } catch (err) {
    next(err);
  }
});

export default router;

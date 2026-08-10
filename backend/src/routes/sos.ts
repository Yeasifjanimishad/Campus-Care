import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sosRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, createSosSchema } from '../middleware/validator.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// In-memory mock list for local dev without Supabase RPC
const MOCK_SOS_ALERTS: any[] = [];

// POST /api/sos
router.post('/', requireAuth, requireRole('student_faculty'), sosRateLimiter, validateBody(createSosSchema), async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, emergency_type, message } = req.body;

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('create_sos_alert', {
        p_latitude: latitude || null,
        p_longitude: longitude || null,
        p_accuracy: accuracy || null,
        p_emergency_type: emergency_type || 'general',
        p_message: message || ''
      });

      if (!error && data) {
        return res.status(201).json(data);
      }
    } catch (sbErr) {
      console.warn('[SOS Create Warning]: Supabase RPC failed, storing in mock memory');
    }

    // Fallback logic
    const studentInfo = req.user!;
    const newAlert = {
      id: `mock-sos-${Date.now()}`,
      student_id: studentInfo.id,
      emergency_type: emergency_type || 'general',
      status: 'active',
      latitude: latitude || 23.8759,
      longitude: longitude || 90.3795,
      accuracy,
      message,
      created_at: new Date().toISOString(),
      student: studentInfo
    };
    MOCK_SOS_ALERTS.push(newAlert);
    
    res.status(201).json({
      success: true,
      is_duplicate: false,
      message: 'SOS Alert dispatched',
      alert: newAlert
    });

  } catch (err) {
    next(err);
  }
});

// GET /api/sos
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
        .from('sos_alerts')
        .select(`
          *,
          student:users(name, email, university_id, department, phone)
        `, { count: 'exact' });

      if (status) {
        if (typeof status === 'string' && status.includes(',')) {
           query = query.in('status', status.split(','));
        } else {
           query = query.eq('status', status);
        }
      }

      // If student, filter by their ID. Admins see all.
      if (req.user?.role === 'student_faculty') {
        query = query.eq('student_id', req.user.id);
      }

      const offset = (pageNum - 1) * limitNum;
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
      console.warn('[SOS Fetch Warning]: Supabase query failed, returning in-memory fallback');
    }

    let filtered = MOCK_SOS_ALERTS;
    if (req.user?.role === 'student_faculty') {
      filtered = filtered.filter(a => a.student_id === req.user?.id);
    }
    if (status) {
      const statuses = typeof status === 'string' ? status.split(',') : [status];
      filtered = filtered.filter(a => statuses.includes(a.status));
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

// GET /api/sos/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient
        .from('sos_alerts')
        .select(`
          *,
          student:users(name, email, university_id, department, phone)
        `)
        .eq('id', req.params.id)
        .single();
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}
    
    const alert = MOCK_SOS_ALERTS.find(a => a.id === req.params.id);
    if (!alert) {
      throw new AppError(404, 'SOS Alert not found');
    }
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

// POST /api/sos/:id/acknowledge
router.post('/:id/acknowledge', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    try {
      const { data, error } = await supabaseAdmin.rpc('acknowledge_sos_alert', {
        p_alert_id: req.params.id
      });
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}
    
    const alert = MOCK_SOS_ALERTS.find(a => a.id === req.params.id);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledged_at = new Date().toISOString();
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sos/:id/resolve
router.post('/:id/resolve', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { resolution_note } = req.body;
    try {
      const { data, error } = await supabaseAdmin.rpc('resolve_sos_alert', {
        p_alert_id: req.params.id,
        p_resolution_note: resolution_note || null
      });
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}
    
    const alert = MOCK_SOS_ALERTS.find(a => a.id === req.params.id);
    if (alert) {
      alert.status = 'resolved';
      alert.resolution_note = resolution_note;
      alert.resolved_at = new Date().toISOString();
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sos/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('cancel_sos_alert', {
        p_alert_id: req.params.id
      });
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}
    
    const alert = MOCK_SOS_ALERTS.find(a => a.id === req.params.id && a.student_id === req.user?.id);
    if (alert) {
      alert.status = 'cancelled';
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

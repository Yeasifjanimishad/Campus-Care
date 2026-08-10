import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sosRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, createSosSchema } from '../middleware/validator.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// POST /api/sos
router.post('/', requireAuth, requireRole('student_faculty'), sosRateLimiter, validateBody(createSosSchema), async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, emergency_type, message } = req.body;

    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('create_sos_alert', {
      p_latitude: latitude || null,
      p_longitude: longitude || null,
      p_accuracy: accuracy || null,
      p_emergency_type: emergency_type || 'general',
      p_message: message || ''
    });

    if (error) {
      throw new AppError(500, 'Failed to create SOS alert', error.message);
    }

    return res.status(201).json(data);
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
    if (error) {
      throw new AppError(500, 'Failed to fetch SOS alerts', error.message);
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

// GET /api/sos/:id
router.get('/:id', requireAuth, async (req, res, next) => {
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

    if (error || !data) {
      throw new AppError(404, 'SOS Alert not found');
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/sos/:id/acknowledge
router.post('/:id/acknowledge', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('acknowledge_sos_alert', {
      p_alert_id: req.params.id
    });

    if (error) {
      throw new AppError(500, 'Failed to acknowledge SOS alert', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/sos/:id/resolve
router.post('/:id/resolve', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { resolution_note } = req.body;
    const { data, error } = await supabaseAdmin.rpc('resolve_sos_alert', {
      p_alert_id: req.params.id,
      p_resolution_note: resolution_note || null
    });

    if (error) {
      throw new AppError(500, 'Failed to resolve SOS alert', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/sos/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('cancel_sos_alert', {
      p_alert_id: req.params.id
    });

    if (error) {
      throw new AppError(500, 'Failed to cancel SOS alert', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

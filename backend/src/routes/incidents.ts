import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// POST /api/incidents
router.post('/', requireAuth, requireRole('student_faculty'), async (req, res, next) => {
  try {
    const { category, title, description, location, incident_date, incident_time, evidence_urls } = req.body;
    
    if (!category || !title || !description) {
      throw new AppError(400, 'Missing required fields');
    }

    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('create_incident_report', {
      p_category: category,
      p_title: title,
      p_description: description,
      p_location: location || null,
      p_incident_date: incident_date || null,
      p_incident_time: incident_time || null,
      p_evidence_urls: evidence_urls || null
    });

    if (error) {
      throw new AppError(500, 'Failed to create incident report', error.message);
    }

    return res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;

    const authClient = createAuthClient(req.token!);
    let query = authClient
      .from('incident_reports')
      .select(`
        *,
        reporter:users!reporter_id(name, email, university_id, department, phone)
      `, { count: 'exact' });

    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        query = query.in('status', status.split(','));
      } else {
        query = query.eq('status', status);
      }
    }
    if (category) query = query.eq('category', category);

    if (req.user?.role === 'student_faculty') {
      query = query.eq('reporter_id', req.user.id);
    }

    const offset = (pageNum - 1) * limitNum;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(500, 'Failed to fetch incidents', error.message);
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

// GET /api/incidents/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient
      .from('incident_reports')
      .select(`
        *,
        reporter:users!reporter_id(name, email, university_id, department, phone)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      throw new AppError(404, 'Incident report not found', error?.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/review
router.post('/:id/review', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('review_incident_report', {
      p_report_id: req.params.id
    });

    if (error) {
      throw new AppError(500, 'Failed to review incident report', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/resolve
router.post('/:id/resolve', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { admin_note } = req.body;
    const { data, error } = await supabaseAdmin.rpc('resolve_incident_report', {
      p_report_id: req.params.id,
      p_admin_note: admin_note || null
    });

    if (error) {
      throw new AppError(500, 'Failed to resolve incident report', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/reject
router.post('/:id/reject', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { admin_note } = req.body;
    const { data, error } = await supabaseAdmin.rpc('reject_incident_report', {
      p_report_id: req.params.id,
      p_admin_note: admin_note || null
    });

    if (error) {
      throw new AppError(500, 'Failed to reject incident report', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

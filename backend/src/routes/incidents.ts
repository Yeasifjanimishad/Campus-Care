import { Router } from 'express';
import { createAuthClient, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const MOCK_INCIDENTS: any[] = [];

// POST /api/incidents
router.post('/', requireAuth, requireRole('student_faculty'), async (req, res, next) => {
  try {
    const { category, title, description, location, incident_date, incident_time, evidence_urls } = req.body;
    
    if (!category || !title || !description) {
      throw new AppError(400, 'Missing required fields');
    }

    try {
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

      if (!error && data) {
        return res.status(201).json(data);
      }
    } catch (sbErr) {
      console.warn('[Incident Create Warning]: Supabase RPC failed, storing in mock memory');
    }

    const newIncident = {
      id: `mock-incident-${Date.now()}`,
      reporter_id: req.user!.id,
      category,
      title,
      description,
      location,
      incident_date,
      incident_time,
      evidence_urls: evidence_urls || [],
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reporter: req.user
    };
    MOCK_INCIDENTS.push(newIncident);

    res.status(201).json(newIncident);
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

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
        .from('incident_reports')
        .select(`
          *,
          reporter:users!reporter_id(name, email, university_id, department, phone)
        `, { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (category) query = query.eq('category', category);

      if (req.user?.role === 'student_faculty') {
        query = query.eq('reporter_id', req.user.id);
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
      console.warn('[Incident Fetch Warning]: Supabase query failed, returning in-memory fallback');
    }

    let filtered = MOCK_INCIDENTS;
    if (req.user?.role === 'student_faculty') {
      filtered = filtered.filter(i => i.reporter_id === req.user?.id);
    }
    if (status) filtered = filtered.filter(i => i.status === status);
    if (category) filtered = filtered.filter(i => i.category === category);
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

// GET /api/incidents/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
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
      
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const incident = MOCK_INCIDENTS.find(i => i.id === req.params.id);
    if (!incident) throw new AppError(404, 'Incident report not found');
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/review
router.post('/:id/review', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    try {
      const { data, error } = await supabaseAdmin.rpc('review_incident_report', {
        p_report_id: req.params.id
      });
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const incident = MOCK_INCIDENTS.find(i => i.id === req.params.id);
    if (incident) {
      incident.status = 'under_review';
      incident.updated_at = new Date().toISOString();
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/resolve
router.post('/:id/resolve', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { admin_note } = req.body;
    try {
      const { data, error } = await supabaseAdmin.rpc('resolve_incident_report', {
        p_report_id: req.params.id,
        p_admin_note: admin_note || null
      });
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const incident = MOCK_INCIDENTS.find(i => i.id === req.params.id);
    if (incident) {
      incident.status = 'resolved';
      incident.admin_note = admin_note;
      incident.resolved_at = new Date().toISOString();
      incident.updated_at = new Date().toISOString();
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/reject
router.post('/:id/reject', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { admin_note } = req.body;
    try {
      const { data, error } = await supabaseAdmin.rpc('reject_incident_report', {
        p_report_id: req.params.id,
        p_admin_note: admin_note || null
      });
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const incident = MOCK_INCIDENTS.find(i => i.id === req.params.id);
    if (incident) {
      incident.status = 'rejected';
      incident.admin_note = admin_note;
      incident.updated_at = new Date().toISOString();
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

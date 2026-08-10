import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAdmin } from '../middleware/auth.js';
import { publicEndpointLimiter } from '../middleware/rateLimiter.js';
import { validateBody, createDoctorRequestSchema } from '../middleware/validator.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/doctor-requests/check-duplicate
router.get('/check-duplicate', async (req, res, next) => {
  try {
    const { email, doctor_id } = req.query;
    if (!email || !doctor_id) {
      throw new AppError(400, 'Missing email or doctor_id');
    }

    const { data, error } = await supabaseAdmin.rpc('check_doctor_request_exists', {
      p_email: email.toString().toLowerCase(),
      p_doctor_id: doctor_id.toString()
    });

    if (error) {
      throw new AppError(500, 'Failed to check duplicate', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests
router.post('/', publicEndpointLimiter, validateBody(createDoctorRequestSchema), async (req, res, next) => {
  try {
    const { full_name, email, doctor_id, department, phone, message } = req.body;

    const cleanEmail = email.toLowerCase();
    
    // Call RPC to check duplicates first
    const { data: checkData, error: checkError } = await supabaseAdmin.rpc('check_doctor_request_exists', {
      p_email: cleanEmail,
      p_doctor_id: doctor_id
    });

    if (checkError) {
      throw new AppError(500, 'Error validating request', checkError.message);
    }

    if (checkData && checkData.length > 0) {
      if (checkData[0].exists_approved) {
        throw new AppError(400, 'An approved doctor record already exists for this email or ID.');
      }
      if (checkData[0].exists_pending) {
        throw new AppError(400, 'A pending request already exists for this email or ID.');
      }
    }

    // Insert new request
    const { data, error } = await supabaseAdmin
      .from('doctor_access_requests')
      .insert([
        {
          full_name,
          email: email.toLowerCase(),
          doctor_id,
          department: department || null,
          phone: phone || null,
          message: message || null
        }
      ])
      .select()
      .single();

    if (error) {
      throw new AppError(500, 'Failed to submit request', error.message);
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/doctor-requests
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('doctor_access_requests')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(500, 'Failed to fetch doctor requests', error.message);
    }

    res.json({
      data,
      total: count,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests/:id/approve
router.post('/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin.rpc('approve_doctor_access_request', {
      p_request_id: id
    });

    if (error) {
      throw new AppError(500, 'Failed to approve request', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests/:id/reject
router.post('/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { review_note } = req.body;

    const { data, error } = await supabaseAdmin.rpc('reject_doctor_access_request', {
      p_request_id: id,
      p_review_note: review_note || null
    });

    if (error) {
      throw new AppError(500, 'Failed to reject request', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

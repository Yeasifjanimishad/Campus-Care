import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/health-records
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, student_id } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const authClient = createAuthClient(req.token!);
    let query = authClient
      .from('health_records')
      .select(`
        *,
        doctor:doctors(id, doctor_id, full_name, email, department, specialization, designation, profile_image_url),
        student:users!student_id(id, name, email, university_id, department, phone),
        appointment:appointments(id, appointment_date, start_time, end_time, reason, status)
      `, { count: 'exact' });

    // Apply RBAC filters
    if (req.user?.role === 'student_faculty') {
      query = query.eq('student_id', req.user.id);
    } else if (req.user?.role === 'doctor') {
      if (student_id) {
        query = query.eq('student_id', student_id);
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(500, 'Failed to fetch health records', error.message);
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

// GET /api/health-records/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient
      .from('health_records')
      .select(`
        *,
        doctor:doctors(id, doctor_id, full_name, email, department, specialization, designation, profile_image_url),
        student:users!student_id(id, name, email, university_id, department, phone),
        appointment:appointments(id, appointment_date, start_time, end_time, reason, status)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      throw new AppError(404, 'Health record not found');
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/health-records
router.post('/', requireAuth, requireRole('doctor'), async (req, res, next) => {
  try {
    const { student_id, diagnosis, appointment_id, clinical_summary, prescription, treatment_plan, follow_up_instructions, doctor_note } = req.body;
    
    if (!student_id || !diagnosis) {
      throw new AppError(400, 'Student ID and diagnosis are required');
    }

    const authClient = createAuthClient(req.token!);

    // Get the doctor's profile ID
    const { data: docData, error: docErr } = await authClient
      .from('doctors')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();

    const doctorId = docData?.id;

    const { data, error } = await authClient.rpc('create_health_record', {
      p_student_id: student_id,
      p_doctor_id: doctorId,
      p_appointment_id: appointment_id || null,
      p_diagnosis: diagnosis,
      p_clinical_summary: clinical_summary || null,
      p_prescription: prescription || null,
      p_treatment_plan: treatment_plan || null,
      p_follow_up_instructions: follow_up_instructions || null,
      p_doctor_note: doctor_note || null
    });

    if (error) {
      throw new AppError(500, 'Failed to create health record', error.message);
    }

    return res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/health-records/:id
router.put('/:id', requireAuth, requireRole('doctor'), async (req, res, next) => {
  try {
    const { diagnosis, clinical_summary, prescription, treatment_plan, follow_up_instructions, doctor_note } = req.body;

    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient.rpc('update_health_record', {
      p_record_id: req.params.id,
      p_diagnosis: diagnosis,
      p_clinical_summary: clinical_summary || null,
      p_prescription: prescription || null,
      p_treatment_plan: treatment_plan || null,
      p_follow_up_instructions: follow_up_instructions || null,
      p_doctor_note: doctor_note || null
    });

    if (error) {
      throw new AppError(500, 'Failed to update health record', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

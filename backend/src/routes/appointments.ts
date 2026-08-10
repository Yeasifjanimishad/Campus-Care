import { Router } from 'express';
import { supabaseAdmin, createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, createAppointmentSchema } from '../middleware/validator.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const MOCK_APPOINTMENTS: any[] = [];

// POST /api/appointments
router.post('/', requireAuth, requireRole('student_faculty'), validateBody(createAppointmentSchema), async (req, res, next) => {
  try {
    const { doctor_id, appointment_date, start_time, end_time, reason, symptoms, student_note } = req.body;

    try {
      const authClient = createAuthClient(req.token!);
      const { data, error } = await authClient.rpc('create_appointment', {
        p_doctor_id: doctor_id,
        p_appointment_date: appointment_date,
        p_start_time: start_time,
        p_end_time: end_time,
        p_reason: reason,
        p_symptoms: symptoms || null,
        p_student_note: student_note || null
      });

      if (!error && data) {
        return res.status(201).json(data);
      }
    } catch (sbErr) {
      console.warn('[Appointments Create Warning]: Supabase RPC failed, storing in mock memory');
    }

    // Fallback in-memory create
    const newAppt = {
      id: `mock-appt-${Date.now()}`,
      student_id: (req as any).user?.id || 'mock-student',
      doctor_id,
      appointment_date,
      start_time,
      end_time,
      reason,
      symptoms,
      student_note,
      status: 'pending',
      created_at: new Date().toISOString(),
      doctor: { full_name: 'Dr. Ayesha Rahman', specialization: 'General Medicine', department: 'Medical Center' },
      student: { name: (req as any).user?.name || 'Student', email: (req as any).user?.email || 'student@diu.edu.bd', phone: '+880 1700-000000' }
    };
    MOCK_APPOINTMENTS.push(newAppt);

    res.status(201).json(newAppt);
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, date, doctor_id, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;

    try {
      const authClient = createAuthClient(req.token!);
      let query = authClient
        .from('appointments')
        .select(`
          *,
          doctor:doctors!appointments_doctor_id_fkey(full_name, specialization, department),
          student:users!appointments_student_id_fkey(name, email, phone)
        `, { count: 'exact' });

      if (status) {
        if (typeof status === 'string' && status.includes(',')) {
          query = query.in('status', status.split(','));
        } else {
          query = query.eq('status', status);
        }
      }
      if (date) query = query.eq('appointment_date', date);
      if (req.query.date_from) query = query.gte('appointment_date', req.query.date_from as string);
      if (doctor_id) query = query.eq('doctor_id', doctor_id);

      const offset = (pageNum - 1) * limitNum;
      query = query
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false })
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
      console.warn('[Appointments Fetch Warning]: Supabase query failed, returning in-memory fallback');
    }

    res.json({
      data: MOCK_APPOINTMENTS,
      total: MOCK_APPOINTMENTS.length,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/booked-slots
router.get('/booked-slots', requireAuth, async (req, res, next) => {
  try {
    const { doctor_id, date } = req.query;
    if (!doctor_id || !date) {
      throw new AppError(400, 'Missing doctor_id or date parameter');
    }

    const authClient = createAuthClient(req.token!);

    const { data, error } = await authClient.rpc('get_booked_slots', {
      p_doctor_id: doctor_id.toString(),
      p_appointment_date: date.toString()
    });

    if (error) {
      throw new AppError(500, 'Failed to fetch booked slots', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // booked-slots is caught by the route above, but just in case
    if (id === 'booked-slots') return next();

    const authClient = createAuthClient(req.token!);
    const { data, error } = await authClient
      .from('appointments')
      .select(`
        *,
        doctor:doctors!appointments_doctor_id_fkey(full_name, specialization, department),
        student:users!appointments_student_id_fkey(name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError(404, 'Appointment not found', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const authClient = createAuthClient(req.token!);

    const { data, error } = await authClient.rpc('cancel_appointment', {
      p_appointment_id: id
    });

    if (error) {
      throw new AppError(500, 'Failed to cancel appointment', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/confirm
router.post('/:id/confirm', requireAuth, requireRole('doctor', 'super_admin', 'emergency_admin', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const authClient = createAuthClient(req.token!);

    const { data, error } = await authClient.rpc('confirm_appointment', {
      p_appointment_id: id
    });

    if (error) {
      throw new AppError(500, 'Failed to confirm appointment', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/reject
router.post('/:id/reject', requireAuth, requireRole('doctor', 'super_admin', 'emergency_admin', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const authClient = createAuthClient(req.token!);

    const { data, error } = await authClient.rpc('reject_appointment', {
      p_appointment_id: id,
      p_rejection_reason: rejection_reason || null
    });

    if (error) {
      throw new AppError(500, 'Failed to reject appointment', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/complete
router.post('/:id/complete', requireAuth, requireRole('doctor', 'super_admin', 'emergency_admin', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { doctor_note } = req.body;
    const authClient = createAuthClient(req.token!);

    const { data, error } = await authClient.rpc('complete_appointment', {
      p_appointment_id: id,
      p_doctor_note: doctor_note || null
    });

    if (error) {
      throw new AppError(500, 'Failed to complete appointment', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

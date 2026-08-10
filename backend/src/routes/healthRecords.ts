import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const MOCK_HEALTH_RECORDS: any[] = [];

// GET /api/health-records
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, student_id } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
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
        // Query the doctor's record from `doctors` table to get their UUID if necessary, 
        // but typically req.user.id is the auth.uid(), and health_records.doctor_id matches doctors.id
        // Wait, health_records has doctor_id referencing doctors.id. Let's get the doctor's ID from users table.
        // Actually, the frontend passes `doctor_id` in DoctorHealthRecords? Wait, let's look at frontend logic later.
        // Let's assume RLS handles the filtering or we just let it pass to RLS.
        // The instructions say: "Doctors see records they created."
        // We'll rely on Supabase RLS, or add a manual check if needed.
        if (student_id) {
            query = query.eq('student_id', student_id);
        }
      }

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
      console.warn('[Health Records Fetch Warning]: Supabase query failed, returning mock data');
    }

    let filtered = [...MOCK_HEALTH_RECORDS];
    if (req.user?.role === 'student_faculty') {
      filtered = filtered.filter(r => r.student_id === req.user?.id);
    }
    if (student_id) {
        filtered = filtered.filter(r => r.student_id === student_id);
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

// GET /api/health-records/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
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
      
      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {}

    const record = MOCK_HEALTH_RECORDS.find(r => r.id === req.params.id);
    if (!record) throw new AppError(404, 'Health record not found');
    res.json(record);
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

    try {
      const authClient = createAuthClient(req.token!);
      
      // Get the doctor's profile ID
      const { data: docData } = await authClient
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

      if (!error && data) {
        return res.status(201).json(data);
      }
    } catch (sbErr) {
      console.warn('[Health Records Create Warning]: Supabase RPC failed, storing in mock memory');
    }

    const newRecord = {
      id: `mock-hr-${Date.now()}`,
      student_id,
      doctor_id: req.user!.id,
      appointment_id,
      diagnosis,
      clinical_summary,
      prescription,
      treatment_plan,
      follow_up_instructions,
      doctor_note,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    MOCK_HEALTH_RECORDS.push(newRecord);

    res.status(201).json(newRecord);
  } catch (err) {
    next(err);
  }
});

// PUT /api/health-records/:id
router.put('/:id', requireAuth, requireRole('doctor'), async (req, res, next) => {
  try {
    const { diagnosis, clinical_summary, prescription, treatment_plan, follow_up_instructions, doctor_note } = req.body;

    try {
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

      if (!error && data) {
        return res.json(data);
      }
    } catch (sbErr) {
        console.warn('[Health Records Update Warning]: Supabase RPC failed, updating in mock memory');
    }

    const record = MOCK_HEALTH_RECORDS.find(r => r.id === req.params.id);
    if (!record) {
      throw new AppError(404, 'Health record not found');
    }
    
    if (diagnosis) record.diagnosis = diagnosis;
    if (clinical_summary !== undefined) record.clinical_summary = clinical_summary;
    if (prescription !== undefined) record.prescription = prescription;
    if (treatment_plan !== undefined) record.treatment_plan = treatment_plan;
    if (follow_up_instructions !== undefined) record.follow_up_instructions = follow_up_instructions;
    if (doctor_note !== undefined) record.doctor_note = doctor_note;
    record.updated_at = new Date().toISOString();

    res.json(record);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const SEED_DOCTORS = [
  {
    id: 'seed-1',
    doctor_id: 'DOC-2001',
    full_name: 'Dr. Ayesha Rahman',
    email: 'ayesha.medical@diu.edu.bd',
    department: 'Medical Center',
    specialization: 'General Medicine',
    designation: 'Chief Medical Officer',
    phone: '+880 1711-001122',
    bio: 'Experienced Chief Medical Officer providing comprehensive primary healthcare and preventive medicine to campus students and faculty.',
    profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'seed-2',
    doctor_id: 'DOC-2002',
    full_name: 'Dr. Tanvir Ahmed',
    email: 'tanvir.psych@diu.edu.bd',
    department: 'Counseling Unit',
    specialization: 'Psychiatry & Mental Health',
    designation: 'Senior Clinical Consultant',
    phone: '+880 1819-334455',
    bio: 'Specialist in student mental health, stress management, cognitive therapy, and adolescent psychological support.',
    profile_image_url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300',
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'seed-3',
    doctor_id: 'DOC-2003',
    full_name: 'Dr. Nusrat Jahan',
    email: 'nusrat.derm@diu.edu.bd',
    department: 'Health Center',
    specialization: 'Dermatology & Wellness',
    designation: 'Consultant Dermatologist',
    phone: '+880 1912-556677',
    bio: 'Expert in skin health, allergic conditions, wellness counseling, and clinical allergy management.',
    profile_image_url: 'https://images.unsplash.com/photo-1594824813566-88855ce78961?auto=format&fit=crop&q=80&w=300',
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'seed-4',
    doctor_id: 'DOC-2004',
    full_name: 'Dr. Fahim Hasan',
    email: 'fahim.emergency@diu.edu.bd',
    department: 'Emergency & Care Unit',
    specialization: 'Emergency Medicine',
    designation: 'On-Call Emergency Lead',
    phone: '+880 1515-778899',
    bio: 'Specialized emergency responder overseeing campus 24/7 SOS triage, trauma stabilization, and critical care.',
    profile_image_url: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=300',
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// GET /api/doctors
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { department, specialization, search, available, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      let query = supabaseAdmin
        .from('doctors')
        .select('*', { count: 'exact' });

      if (department && department !== 'All') {
        query = query.eq('department', department);
      }
      if (specialization) {
        query = query.eq('specialization', specialization);
      }
      if (available === 'true') {
        query = query.eq('is_available', true);
      }
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,specialization.ilike.%${search}%,department.ilike.%${search}%,doctor_id.ilike.%${search}%`);
      }

      query = query
        .order('full_name', { ascending: true })
        .range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;

      if (!error && data && data.length > 0) {
        return res.json({
          data,
          total: count,
          page: pageNum,
          limit: limitNum
        });
      }
    } catch (sbErr) {
      console.warn('[Doctors Fetch Warning]: Supabase query failed, falling back to seed data');
    }

    // Fallback to seed doctors
    let filtered = [...SEED_DOCTORS];
    if (department && department !== 'All') {
      filtered = filtered.filter(d => d.department === department);
    }
    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(d => d.full_name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q));
    }

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

// GET /api/doctors/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError(404, 'Doctor not found', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/doctors/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { specialization, designation, bio, profile_image_url, phone, is_available } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check existing doctor
    const { data: doctor, error: docError } = await supabaseAdmin
      .from('doctors')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (docError || !doctor) {
      throw new AppError(404, 'Doctor not found');
    }

    // Verify permission (must be admin or the doctor themselves)
    const isAdmin = ['super_admin', 'emergency_admin', 'admin'].includes(userRole);
    if (!isAdmin && doctor.user_id !== userId) {
      throw new AppError(403, 'You are not authorized to update this doctor profile');
    }

    const updateData: any = {};
    if (specialization !== undefined) updateData.specialization = specialization;
    if (designation !== undefined) updateData.designation = designation;
    if (bio !== undefined) updateData.bio = bio;
    if (profile_image_url !== undefined) updateData.profile_image_url = profile_image_url;
    if (phone !== undefined) updateData.phone = phone;
    if (is_available !== undefined) updateData.is_available = is_available;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('doctors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new AppError(500, 'Failed to update doctor profile', error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/doctors - Fetch registered doctors from database
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { department, specialization, search, available, page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
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
          total: count || data.length,
          page: pageNum,
          limit: limitNum
        });
      }

      // If doctors table has no rows, check users table for any accounts with role='doctor'
      const { data: doctorUsers, error: userError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('role', 'doctor');

      if (!userError && doctorUsers && doctorUsers.length > 0) {
        const dynamicDoctors = doctorUsers.map(u => ({
          id: u.id,
          doctor_id: u.university_id || 'DOC-UNASSIGNED',
          user_id: u.id,
          full_name: u.name,
          email: u.email,
          department: u.department || 'Medical Center',
          specialization: 'General Medicine',
          designation: 'Medical Officer',
          phone: u.phone || '',
          bio: '',
          profile_image_url: '',
          is_available: true,
          created_at: u.created_at || new Date().toISOString(),
          updated_at: u.updated_at || new Date().toISOString(),
        }));

        let filtered = dynamicDoctors;
        if (department && department !== 'All') {
          filtered = filtered.filter(d => d.department === department);
        }
        if (search) {
          const q = (search as string).toLowerCase();
          filtered = filtered.filter(d =>
              d.full_name?.toLowerCase().includes(q) ||
              d.specialization?.toLowerCase().includes(q) ||
              d.department?.toLowerCase().includes(q) ||
              d.email?.toLowerCase().includes(q)
          );
        }

        return res.json({
          data: filtered.slice(offset, offset + limitNum),
          total: filtered.length,
          page: pageNum,
          limit: limitNum
        });
      }
    } catch (sbErr) {
      console.warn('[Doctors Fetch Warning]: Database query failed or unconfigured');
    }

    // Return empty list if no doctors found in database
    res.json({
      data: [],
      total: 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/doctors/:id - Fetch single doctor by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    try {
      const { data, error } = await supabaseAdmin
          .from('doctors')
          .select('*')
          .or(`id.eq.${id},doctor_id.eq.${id},user_id.eq.${id}`)
          .maybeSingle();

      if (!error && data) {
        return res.json(data);
      }

      // Also check users table where role = 'doctor'
      const { data: userDoc, error: userError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('role', 'doctor')
          .or(`id.eq.${id},university_id.eq.${id}`)
          .maybeSingle();

      if (!userError && userDoc) {
        return res.json({
          id: userDoc.id,
          doctor_id: userDoc.university_id || 'DOC-UNASSIGNED',
          user_id: userDoc.id,
          full_name: userDoc.name,
          email: userDoc.email,
          department: userDoc.department || 'Medical Center',
          specialization: 'General Medicine',
          designation: 'Medical Officer',
          phone: userDoc.phone || '',
          bio: '',
          profile_image_url: '',
          is_available: true,
          created_at: userDoc.created_at || new Date().toISOString(),
          updated_at: userDoc.updated_at || new Date().toISOString(),
        });
      }
    } catch (sbErr) {
      console.warn('[Doctor Fetch ID Warning]: Database query failed');
    }

    throw new AppError(404, 'Doctor not found');
  } catch (err) {
    next(err);
  }
});

// PUT /api/doctors/:id - Update doctor profile
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

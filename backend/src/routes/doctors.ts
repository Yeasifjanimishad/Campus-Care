import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/doctors
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { department, specialization, search, available, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

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

    if (error) {
      throw new AppError(500, 'Failed to fetch doctors', error.message);
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

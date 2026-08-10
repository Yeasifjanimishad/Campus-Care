import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/doctors - Fetch registered doctors from database
router.get('/', async (req, res, next) => {
  try {
    const { department, specialization, search, available, page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    try {
      // 1. Fetch from doctors catalog table
      const { data: doctorsData, error: docError } = await supabaseAdmin
        .from('doctors')
        .select('*');

      // 2. Fetch from users table with role='doctor'
      const { data: doctorUsers } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('role', 'doctor');

      // 3. Fetch approved requests
      const { data: approvedRequests } = await supabaseAdmin
        .from('doctor_access_requests')
        .select('*')
        .eq('status', 'approved');

      // Combine and deduplicate doctors by email (lowercase) and doctor_id
      const doctorMap = new Map<string, any>();

      // A) Process approved requests as baseline
      if (approvedRequests) {
        for (const req of approvedRequests) {
          const emailKey = req.email?.toLowerCase().trim();
          if (!emailKey) continue;
          doctorMap.set(emailKey, {
            id: req.id,
            doctor_id: req.doctor_id || 'DOC-APPROVED',
            user_id: null,
            full_name: req.full_name,
            name: req.full_name,
            email: req.email,
            department: req.department || 'Medical Center',
            specialization: req.department || 'General Medicine',
            designation: 'Consultant Physician',
            phone: req.phone || '+880 1700-000000',
            room_number: 'Room 101, Medical Center',
            available_days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            start_time: '09:00:00',
            end_time: '17:00:00',
            bio: req.message || 'University Medical Center Attending Physician',
            avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            is_available: true,
            created_at: req.created_at || new Date().toISOString(),
            updated_at: req.updated_at || new Date().toISOString(),
          });
        }
      }

      // B) Overlay users table data
      if (doctorUsers) {
        for (const u of doctorUsers) {
          const emailKey = u.email?.toLowerCase().trim();
          if (!emailKey) continue;
          const existing = doctorMap.get(emailKey) || {};
          doctorMap.set(emailKey, {
            ...existing,
            id: existing.id || u.id,
            user_id: u.id,
            doctor_id: u.university_id || existing.doctor_id || 'DOC-STAFF',
            full_name: u.name || existing.full_name || 'Medical Officer',
            name: u.name || existing.name || 'Medical Officer',
            email: u.email,
            department: u.department || existing.department || 'Medical Center',
            specialization: existing.specialization || u.department || 'General Medicine',
            designation: existing.designation || 'Consultant Physician',
            phone: u.phone || existing.phone || '+880 1700-000000',
            room_number: existing.room_number || 'Room 101, Medical Center',
            available_days: existing.available_days || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            start_time: existing.start_time || '09:00:00',
            end_time: existing.end_time || '17:00:00',
            avatar_url: existing.avatar_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            profile_image_url: existing.profile_image_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            is_available: u.status === 'active' ? (existing.is_available ?? true) : false,
            created_at: u.created_at || existing.created_at,
            updated_at: u.updated_at || existing.updated_at,
          });
        }
      }

      // C) Overlay explicit doctors catalog rows (highest priority)
      if (doctorsData && !docError) {
        for (const d of doctorsData) {
          const emailKey = (d.email || '').toLowerCase().trim();
          const key = emailKey || d.doctor_id || d.id;
          const existing = emailKey ? (doctorMap.get(emailKey) || {}) : {};
          doctorMap.set(key, {
            ...existing,
            ...d,
            id: d.id,
            doctor_id: d.doctor_id || existing.doctor_id || 'DOC-OFFICER',
            user_id: d.user_id || existing.user_id,
            full_name: d.full_name || (d as any).name || existing.full_name || 'Medical Specialist',
            name: (d as any).name || d.full_name || existing.name || 'Medical Specialist',
            email: d.email || existing.email,
            department: d.department || existing.department || 'Medical Center',
            specialization: d.specialization || existing.specialization || d.department || 'General Medicine',
            designation: d.designation || existing.designation || 'Consultant Physician',
            phone: d.phone || existing.phone || '+880 1700-000000',
            room_number: d.room_number || existing.room_number || 'Room 101, Medical Center',
            available_days: d.available_days || existing.available_days || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            start_time: d.start_time || existing.start_time || '09:00:00',
            end_time: d.end_time || existing.end_time || '17:00:00',
            avatar_url: d.avatar_url || existing.avatar_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            profile_image_url: d.avatar_url || existing.profile_image_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            is_available: d.is_available ?? existing.is_available ?? true,
          });
        }
      }

      let allDoctors = Array.from(doctorMap.values());

      // Filter by department
      if (department && department !== 'All') {
        allDoctors = allDoctors.filter(d => 
          (d.department && d.department.toLowerCase() === (department as string).toLowerCase()) ||
          (d.specialization && d.specialization.toLowerCase().includes((department as string).toLowerCase()))
        );
      }

      // Filter by specialization
      if (specialization) {
        allDoctors = allDoctors.filter(d => 
          d.specialization && d.specialization.toLowerCase().includes((specialization as string).toLowerCase())
        );
      }

      // Filter by availability
      if (available === 'true') {
        allDoctors = allDoctors.filter(d => d.is_available === true);
      }

      // Filter by search query
      if (search) {
        const q = (search as string).toLowerCase().trim();
        allDoctors = allDoctors.filter(d =>
          d.full_name?.toLowerCase().includes(q) ||
          d.name?.toLowerCase().includes(q) ||
          d.specialization?.toLowerCase().includes(q) ||
          d.department?.toLowerCase().includes(q) ||
          d.doctor_id?.toLowerCase().includes(q) ||
          d.email?.toLowerCase().includes(q)
        );
      }

      // Sort alphabetically by name
      allDoctors.sort((a, b) => (a.full_name || a.name || '').localeCompare(b.full_name || b.name || ''));

      const total = allDoctors.length;
      const paginated = allDoctors.slice(offset, offset + limitNum);

      return res.json({
        data: paginated,
        total,
        page: pageNum,
        limit: limitNum
      });
    } catch (sbErr) {
      console.warn('[Doctors Fetch Exception]:', sbErr);
    }

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
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    try {
      const { data, error } = await supabaseAdmin
          .from('doctors')
          .select('*')
          .or(`id.eq.${id},doctor_id.eq.${id},user_id.eq.${id}`)
          .maybeSingle();

      if (!error && data) {
        return res.json({
          ...data,
          profile_image_url: data.avatar_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300'
        });
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
          room_number: 'Room 101, Medical Center',
          available_days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
          start_time: '09:00:00',
          end_time: '17:00:00',
          bio: '',
          avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
          profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
          is_available: userDoc.status === 'active',
          created_at: userDoc.created_at || new Date().toISOString(),
          updated_at: userDoc.updated_at || new Date().toISOString(),
        });
      }
    } catch (sbErr) {
      console.warn('[Doctor Fetch ID Warning]: Database query failed', sbErr);
    }

    throw new AppError(404, 'Doctor not found');
  } catch (err) {
    next(err);
  }
});

// POST /api/doctors - Create or register a doctor in the database
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      doctor_id,
      full_name,
      name,
      email,
      department,
      specialization,
      designation,
      phone,
      room_number,
      available_days,
      start_time,
      end_time,
      is_available,
      avatar_url,
      profile_image_url,
      user_id
    } = req.body;

    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanDocId = (doctor_id || '').trim();
    const cleanFullName = (full_name || name || '').trim();

    if (!cleanEmail || !cleanDocId || !cleanFullName) {
      throw new AppError(400, 'Full name, email, and Doctor ID are required to save doctor data.');
    }

    // 1. Resolve user ID from public.users if available
    let resolvedUserId = user_id || null;
    if (!resolvedUserId) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (userData) {
        resolvedUserId = userData.id;
        // Ensure role is doctor
        if (userData.role !== 'doctor') {
          await supabaseAdmin
            .from('users')
            .update({ role: 'doctor', name: cleanFullName, department: department || 'Medical Center', phone: phone || null })
            .eq('id', userData.id);
        }
      }
    }

    // 2. Prepare payload matching exact public.doctors schema
    const payload: Record<string, any> = {
      doctor_id: cleanDocId,
      full_name: cleanFullName.startsWith('Dr.') ? cleanFullName : `Dr. ${cleanFullName}`,
      email: cleanEmail,
      department: department?.trim() || 'Medical Center',
      specialization: specialization?.trim() || department?.trim() || 'General Medicine',
      designation: designation?.trim() || 'Consultant Physician',
      phone: phone?.trim() || '+880 1700-000000',
      room_number: room_number?.trim() || 'Room 101, Medical Center',
      available_days: Array.isArray(available_days) && available_days.length > 0
        ? available_days
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      start_time: start_time || '09:00:00',
      end_time: end_time || '17:00:00',
      is_available: is_available !== undefined ? Boolean(is_available) : true,
      avatar_url: avatar_url || profile_image_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
      updated_at: new Date().toISOString(),
    };

    if (resolvedUserId) {
      payload.user_id = resolvedUserId;
    }

    // 3. Check if doctor already exists
    const { data: existingDoctor } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .or(`doctor_id.eq.${cleanDocId},email.eq.${cleanEmail}`)
      .maybeSingle();

    let savedDoctor: any = null;

    if (existingDoctor?.id) {
      const { data, error } = await supabaseAdmin
        .from('doctors')
        .update(payload)
        .eq('id', existingDoctor.id)
        .select()
        .single();

      if (error) {
        console.error('[Doctor Update Error]:', error);
        throw new AppError(500, 'Failed to update doctor record: ' + error.message);
      }
      savedDoctor = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('doctors')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[Doctor Insert Error]:', error);
        throw new AppError(500, 'Failed to insert doctor record: ' + error.message);
      }
      savedDoctor = data;
    }

    return res.status(201).json({
      success: true,
      data: {
        ...savedDoctor,
        profile_image_url: savedDoctor.avatar_url
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/doctors/:id - Update or upsert doctor profile in database
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      name,
      department,
      specialization,
      designation,
      phone,
      room_number,
      available_days,
      start_time,
      end_time,
      is_available,
      avatar_url,
      profile_image_url
    } = req.body;

    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const isAdmin = ['super_admin', 'emergency_admin', 'admin'].includes(userRole);

    // 1. Find existing doctor by id, doctor_id, user_id, or email
    const { data: existingDoctor } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .or(`id.eq.${id},doctor_id.eq.${id},user_id.eq.${id},email.eq.${user.email}`)
      .maybeSingle();

    // Verify permission if doctor exists
    if (existingDoctor && !isAdmin && existingDoctor.user_id && existingDoctor.user_id !== userId) {
      throw new AppError(403, 'You are not authorized to update this doctor profile');
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (full_name || name) updateData.full_name = (full_name || name).trim();
    if (department !== undefined) updateData.department = department.trim();
    if (specialization !== undefined) updateData.specialization = specialization.trim();
    if (designation !== undefined) updateData.designation = designation.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (room_number !== undefined) updateData.room_number = room_number.trim();
    if (available_days !== undefined && Array.isArray(available_days)) updateData.available_days = available_days;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (is_available !== undefined) updateData.is_available = Boolean(is_available);
    if (avatar_url || profile_image_url) updateData.avatar_url = avatar_url || profile_image_url;

    let resultData: any = null;

    if (existingDoctor?.id) {
      const { data, error } = await supabaseAdmin
        .from('doctors')
        .update(updateData)
        .eq('id', existingDoctor.id)
        .select()
        .single();

      if (error) {
        console.error('[Doctor Update Error]:', error);
        throw new AppError(500, 'Failed to update doctor profile: ' + error.message);
      }
      resultData = data;
    } else {
      // If doctor row does not exist yet in public.doctors, create it now!
      const createPayload: Record<string, any> = {
        doctor_id: user.university_id || id.startsWith('DOC') ? id : 'DOC-' + Math.floor(1000 + Math.random() * 9000),
        full_name: updateData.full_name || user.name || 'Dr. Medical Officer',
        email: user.email,
        department: updateData.department || user.department || 'Medical Center',
        specialization: updateData.specialization || 'General Medicine',
        designation: updateData.designation || 'Consultant Physician',
        phone: updateData.phone || user.phone || '+880 1700-000000',
        room_number: updateData.room_number || 'Room 101, Medical Center',
        available_days: updateData.available_days || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        start_time: updateData.start_time || '09:00:00',
        end_time: updateData.end_time || '17:00:00',
        is_available: updateData.is_available ?? true,
        avatar_url: updateData.avatar_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('doctors')
        .insert([createPayload])
        .select()
        .single();

      if (error) {
        console.error('[Doctor Creation Upsert Error]:', error);
        throw new AppError(500, 'Failed to save doctor profile: ' + error.message);
      }
      resultData = data;
    }

    // Also sync public.users if applicable
    if (userId) {
      const userUpdates: Record<string, any> = { role: 'doctor' };
      if (updateData.full_name) userUpdates.name = updateData.full_name;
      if (updateData.department) userUpdates.department = updateData.department;
      if (updateData.phone) userUpdates.phone = updateData.phone;

      await supabaseAdmin
        .from('users')
        .update(userUpdates)
        .eq('id', userId);
    }

    res.json({
      ...resultData,
      profile_image_url: resultData.avatar_url
    });
  } catch (err) {
    next(err);
  }
});

export default router;


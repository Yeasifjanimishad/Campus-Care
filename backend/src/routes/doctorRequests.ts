import { Router } from 'express';
import { supabaseAdmin, createAuthClient } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
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

    const cleanEmail = email.toString().toLowerCase();
    const cleanDocId = doctor_id.toString();

    const { data: pendingData } = await supabaseAdmin
      .from('doctor_access_requests')
      .select('id')
      .eq('status', 'pending')
      .or(`email.eq.${cleanEmail},doctor_id.eq.${cleanDocId}`);

    const { data: approvedData } = await supabaseAdmin
      .from('doctor_access_requests')
      .select('id')
      .eq('status', 'approved')
      .or(`email.eq.${cleanEmail},doctor_id.eq.${cleanDocId}`);

    const existsPending = pendingData && pendingData.length > 0;
    const existsApproved = approvedData && approvedData.length > 0;

    res.json([{ exists_pending: existsPending, exists_approved: existsApproved }]);
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests
router.post('/', publicEndpointLimiter, validateBody(createDoctorRequestSchema), async (req, res, next) => {
  try {
    const { full_name, email, doctor_id, department, phone, message } = req.body;

    const cleanEmail = email.toLowerCase();
    
    // Call backend directly to check duplicates instead of missing RPC
    const { data: pendingData, error: pendingError } = await supabaseAdmin
      .from('doctor_access_requests')
      .select('id')
      .eq('status', 'pending')
      .or(`email.eq.${cleanEmail},doctor_id.eq.${doctor_id}`);

    if (pendingError) {
      throw new AppError(500, 'Error validating request (pending)', pendingError.message);
    }
    if (pendingData && pendingData.length > 0) {
      throw new AppError(400, 'A pending request already exists for this email or ID.');
    }

    const { data: approvedData, error: approvedError } = await supabaseAdmin
      .from('doctor_access_requests')
      .select('id')
      .eq('status', 'approved')
      .or(`email.eq.${cleanEmail},doctor_id.eq.${doctor_id}`);

    if (approvedError) {
      throw new AppError(500, 'Error validating request (approved)', approvedError.message);
    }
    if (approvedData && approvedData.length > 0) {
      throw new AppError(400, 'An approved doctor record already exists for this email or ID.');
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
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const authClient = createAuthClient(req.token!);
    let query = authClient
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

// Helper function to generate a secure random temporary password
const generateTempPassword = (length: number = 12): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
  let password = '';
  // Ensure at least one of each required character type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*()_+'[Math.floor(Math.random() * 12)];
  
  for (let i = 4; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

// POST /api/doctor-requests/:id/approve
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const authClient = createAuthClient(req.token!);

    // 1. Fetch the pending request
    const { data: request, error: fetchError } = await authClient
      .from('doctor_access_requests')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !request) {
      throw new AppError(404, 'Request not found or is no longer pending', fetchError?.message);
    }

    let userId: string;
    let tempPassword: string | null = null;
    let isNewUser = false;

    // 2. Check if user already exists
    const { data: existingProfiles } = await authClient
      .from('users')
      .select('id')
      .eq('email', request.email);

    if (existingProfiles && existingProfiles.length > 0) {
      // User profile already exists
      userId = existingProfiles[0].id;
      
      // Update their profile to 'doctor' role
      await authClient
        .from('users')
        .update({
          role: 'doctor',
          name: request.full_name,
          university_id: request.doctor_id,
          department: request.department,
          phone: request.phone || null
        })
        .eq('id', userId);
    } else {
      // Generate a temporary password and create a new Auth user
      tempPassword = generateTempPassword();
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: request.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: request.full_name }
      });

      if (authError || !authData.user) {
        throw new AppError(500, 'Failed to create auth user', authError?.message);
      }
      
      userId = authData.user.id;
      isNewUser = true;

      // Insert into public.users
      const { error: profileError } = await authClient
        .from('users')
        .insert({
          id: userId,
          email: request.email,
          name: request.full_name,
          university_id: request.doctor_id,
          role: 'doctor',
          department: request.department,
          phone: request.phone || null
        });
        
      if (profileError) {
          // Rollback Auth user creation if DB insert fails
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw new AppError(500, 'Failed to create user profile', profileError.message);
      }
    }

    // 3. Mark request as approved
    await authClient
      .from('doctor_access_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user!.id
      })
      .eq('id', id);

    // 4. Create or update doctor record
    const { data: existingDoctor } = await authClient
      .from('doctors')
      .select('id')
      .eq('doctor_id', request.doctor_id);
      
    if (existingDoctor && existingDoctor.length > 0) {
        await authClient
          .from('doctors')
          .update({
            user_id: userId,
            full_name: request.full_name,
            email: request.email,
            department: request.department,
            phone: request.phone || null
          })
          .eq('doctor_id', request.doctor_id);
    } else {
        await authClient
          .from('doctors')
          .insert({
            user_id: userId,
            doctor_id: request.doctor_id,
            full_name: request.full_name,
            email: request.email,
            department: request.department,
            specialization: 'General Medicine', // Default
            phone: request.phone || null,
            designation: 'Consultant Physician',
            is_available: true
          });
    }

    // 5. Add Audit Log
    await authClient
      .from('admin_audit_logs')
      .insert({
        actor_id: req.user!.id,
        action: 'doctor_approved',
        target_user_id: userId,
        metadata: {
          doctor_id: request.doctor_id,
          email: request.email,
          full_name: request.full_name,
          department: request.department
        }
      });

    res.json({
      success: true,
      message: 'Doctor request approved and doctor profile assigned successfully.',
      tempPassword: tempPassword,
      isNewUser: isNewUser
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/doctor-requests/:id/reject
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { review_note } = req.body;
    const authClient = createAuthClient(req.token!);

    // 1. Fetch the pending request
    const { data: request, error: fetchError } = await authClient
      .from('doctor_access_requests')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !request) {
      throw new AppError(404, 'Request not found or is no longer pending', fetchError?.message);
    }

    // 2. Mark request as rejected
    const { error: updateError } = await authClient
      .from('doctor_access_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user!.id,
        review_note: review_note || 'Access request rejected by university administration.'
      })
      .eq('id', id);

    if (updateError) {
      throw new AppError(500, 'Failed to reject request', updateError.message);
    }

    // 3. Optional: Add Audit Log
    const { data: existingUser } = await authClient
      .from('users')
      .select('id')
      .eq('email', request.email);

    await authClient
      .from('admin_audit_logs')
      .insert({
        actor_id: req.user!.id,
        action: 'doctor_rejected',
        target_user_id: (existingUser && existingUser.length > 0) ? existingUser[0].id : null,
        metadata: {
          doctor_id: request.doctor_id,
          email: request.email,
          full_name: request.full_name,
          review_note: review_note || null
        }
      });

    res.json({
      success: true,
      message: 'Doctor request rejected successfully.'
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, loginSchema, signupSchema, doctorLoginSchema } from '../middleware/validator.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// Apply auth rate limiter to all auth routes
router.use(authRateLimiter);

// POST /api/auth/signup
router.post('/signup', validateBody(signupSchema), async (req, res, next) => {
  try {
    const { email, password, name, university_id, department, phone } = req.body;

    // Try regular signUp instead of admin.createUser as it works with anon keys too
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (authError || !authData.user) {
      throw new AppError(400, 'Failed to create user account', authError?.message);
    }

    // Insert into public.users
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          name,
          university_id,
          department: department || null,
          phone: phone || null,
          role: 'student_faculty',
          status: 'active',
        }
      ])
      .select()
      .single();

    if (dbError) {
      // Cleanup the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new AppError(500, 'Failed to create user profile', dbError.message);
    }

    // To return session tokens, we must do a signIn
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      throw new AppError(500, 'Failed to automatically sign in', signInError?.message);
    }

    res.status(201).json({
      user: profile,
      session: signInData.session,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.trim().toLowerCase();

    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData?.user || !authData?.session) {
      throw new AppError(401, 'Invalid credentials', authError?.message);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError(404, 'User profile not found', profileError?.message);
    }

    if (profile.status !== 'active' && profile.status !== 'pending') {
      throw new AppError(403, `Account is ${profile.status}`);
    }

    return res.json({
      user: profile,
      session: authData.session,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/doctor-login
router.post('/doctor-login', validateBody(doctorLoginSchema), async (req, res, next) => {
  try {
    const { doctor_id, password } = req.body;
    
    // 1. Look up the doctor's email using university_id (where doctor_id is stored)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('email, id, status, role')
      .eq('university_id', doctor_id)
      .eq('role', 'doctor')
      .single();
      
    if (profileError || !profile) {
      throw new AppError(404, 'Doctor profile not found. Please check your Doctor ID.');
    }
    
    if (profile.status !== 'active' && profile.status !== 'pending') {
      throw new AppError(403, `Account is ${profile.status}`);
    }

    // 2. Authenticate with Supabase using the retrieved email
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (authError || !authData?.user || !authData?.session) {
      throw new AppError(401, 'Invalid credentials', authError?.message);
    }
    
    // 3. Fetch full profile to return
    const { data: fullProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    return res.json({
      user: fullProfile || profile,
      session: authData.session,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      // Note: Supabase auth.admin.signOut takes a user id, but to invalidate a specific token,
      // it's not straightforward via admin API. The client invalidates its local session anyway.
      // But we can do admin.signOut(req.user.id) to sign out of all devices
      await supabaseAdmin.auth.admin.signOut(req.user!.id);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/session
router.get('/session', requireAuth, async (req, res, next) => {
  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    if (profileError || !profile) {
      if (req.user) {
        return res.json({ user: req.user });
      }
      throw new AppError(404, 'User profile not found');
    }

    res.json({ user: profile });
  } catch (error) {
    if (req.user) {
      return res.json({ user: req.user });
    }
    next(error);
  }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, phone, department } = req.body;
    
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (department !== undefined) updates.department = department;

    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) {
      throw new AppError(500, 'Failed to update profile', error.message);
    }

    res.json({ user: profile });
  } catch (error) {
    next(error);
  }
});

export default router;

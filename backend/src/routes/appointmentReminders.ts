import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/appointment-reminders
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // We want the current user's upcoming appointments
    const { data, error } = await authClient
      .from('appointments')
      .select(`
        *,
        doctors (
          id,
          doctor_id,
          full_name,
          email,
          department,
          specialization,
          designation,
          profile_image_url
        )
      `)
      .in('status', ['confirmed', 'pending'])
      .gte('appointment_date', todayStr)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(5);

    if (error) {
      throw new AppError(500, 'Failed to fetch appointment reminders', error.message);
    }

    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// GET /api/appointment-reminders
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const authClient = createAuthClient(req.token!);
    
    // We only want the current user's reminders
    // Assuming RLS policy: sent_to_user_id = auth.uid()
    const { data, error } = await authClient
      .from('appointment_reminders')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50); // Get latest 50 reminders

    if (error) {
      throw new AppError(500, 'Failed to fetch appointment reminders', error.message);
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;

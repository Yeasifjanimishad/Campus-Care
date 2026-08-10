import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabase.js';

let cronTask: cron.ScheduledTask | null = null;

export const startScheduler = () => {
  if (cronTask) {
    console.log('Scheduler already running');
    return;
  }

  // Run every 5 minutes
  cronTask = cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Running scheduled tasks...');

    try {
      const { data, error } = await supabaseAdmin.rpc('run_scheduled_tasks');
      if (error) {
        console.error('[Scheduler] Error running tasks:', error.message);
      } else {
        console.log('[Scheduler] Tasks completed:', data);
      }
    } catch (err) {
      console.error('[Scheduler] Exception running tasks:', err);
    }
  });

  console.log('[Scheduler] Node.js cron scheduler started (runs every 5 minutes)');
};

export const stopScheduler = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[Scheduler] Node.js cron scheduler stopped');
  }
};

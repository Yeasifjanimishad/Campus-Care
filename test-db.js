import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hyenslxslxotpnmwskve.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const run = async () => {
  const { data, error } = await supabaseAdmin.from('doctor_access_requests').select('*');
  console.log('DB Data:', data);
  console.log('DB Error:', error);
};
run();

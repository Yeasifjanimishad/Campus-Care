import { supabaseAdmin } from './src/lib/supabase.js';

async function test() {
  console.log("Fetching users...");
  const { data: users, error } = await supabaseAdmin.from('users').select('*');
  console.log("Users:", users);
  console.log("Error:", error);
}

test();

import { supabaseAdmin } from './src/lib/supabase.js';

async function test() {
  console.log("Fetching Auth users...");
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
  console.log("Users:", users.users.map(u => ({ id: u.id, email: u.email })));
  console.log("Error:", error);
}

test();

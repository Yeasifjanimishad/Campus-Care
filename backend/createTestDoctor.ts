import { supabaseAdmin } from './src/lib/supabase.js';

async function create() {
  console.log("Creating test doctor with ID: DOC-2024-001");
  const email = 'doctor@diu.edu.bd';
  const password = 'Password123!';

  // First, check if the auth user exists and delete it if it does
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingDoctor = existingUsers?.users?.find(u => u.email === email);
  
  if (existingDoctor) {
    console.log("Deleting existing test doctor...");
    await supabaseAdmin.auth.admin.deleteUser(existingDoctor.id);
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Dr. John Doe' }
  });

  if (authError || !authData.user) {
    console.log("Auth Error:", authError);
    return;
  }

  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      name: 'Dr. John Doe',
      role: 'doctor',
      university_id: 'DOC-2024-001',
      status: 'active'
    });

  if (profileError) {
    console.log("Profile Error:", profileError);
  } else {
    console.log("Created test doctor successfully! Login with DOC-2024-001 and Password123!");
  }
}

create();

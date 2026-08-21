import { supabaseAdmin } from './src/lib/supabase.js';

async function test() {
  const doctor_id = 'DOC-12345';
  console.log(`Querying for doctor with university_id: ${doctor_id}`);
  
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('email, id, status, role')
    .eq('university_id', doctor_id)
    .eq('role', 'doctor')
    .single();

  console.log("Profile:", profile);
  console.log("Error:", profileError);
}

test();

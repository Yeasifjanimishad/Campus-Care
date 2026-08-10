import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching a doctor...");
  const { data: doctors, error: docErr } = await supabase.from('doctors').select('id').limit(1);
  if (docErr || !doctors.length) {
    console.error("No doctor:", docErr);
    return;
  }
  const doctor_id = doctors[0].id;
  
  console.log("Fetching a student...");
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (userErr || !users.length) {
    console.error("No user:", userErr);
    return;
  }
  const student_id = users[0].id;

  console.log("Calling create_appointment...");
  const { data, error } = await supabase.rpc('create_appointment', {
    p_doctor_id: doctor_id,
    p_appointment_date: '2026-08-12',
    p_start_time: '10:00:00',
    p_end_time: '10:30:00',
    p_reason: 'Test from Node',
    p_student_id: student_id
  });

  console.log("Result:", data, "Error:", error);
}

run();

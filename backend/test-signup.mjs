import { supabaseAdmin } from './src/lib/supabase.js';

async function test() {
  console.log("Testing Signup...");
  const email = 'test_user123@diu.edu.bd';
  const password = 'Password123!';
  
  // Try to create the user
  const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      data: { name: 'Test User' }
    }
  });
  console.log("Signup Data:", authData);
  console.log("Signup Error:", authError);

  if (authData?.user) {
    console.log("Testing Login immediately after signup...");
    const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    console.log("Login Data:", loginData?.user?.id);
    console.log("Login Error:", loginError);
  }
}

test();

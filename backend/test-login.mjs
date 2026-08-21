import { supabaseAdmin } from './src/lib/supabase.js';

async function test() {
  console.log("Testing Student Login...");
  const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
    email: 'sokal@diu.edu.bd',
    password: 'Password123!',
  });
  console.log("Auth Data:", authData);
  console.log("Auth Error:", authError);

  if (authData?.user) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    console.log("Profile:", profile);
    console.log("Profile Error:", profileError);
  }
}

test();

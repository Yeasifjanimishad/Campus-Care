import { supabaseAdmin } from './src/lib/supabase.js';

async function fixPasswords() {
  const emails = [
    'sokal@diu.edu.bd',
    'mishad242-35-739@diu.edu.bd',
    'superadmin@diu.edu.bd',
    'tahmid242-35-799@diu.edu.bd'
  ];

  for (const email of emails) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    const user = data?.users.find(u => u.email === email);
    
    if (user) {
      console.log(`Updating password for ${email}...`);
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: 'Password123!' }
      );
      if (updateError) console.error(`Error updating ${email}:`, updateError);
      else console.log(`Updated ${email} successfully.`);
    } else {
      console.log(`User ${email} not found in Auth.`);
    }
  }
}

fixPasswords();

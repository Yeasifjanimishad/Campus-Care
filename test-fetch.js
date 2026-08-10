import fetch from 'node-fetch';
const run = async () => {
  try {
    // 1. login to get token
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@diu.edu.bd', password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    if (!loginData.session) {
      console.log('Login failed:', loginData);
      return;
    }
    const token = loginData.session.access_token;
    console.log('Logged in!');

    // 2. Fetch system health
    const reqRes = await fetch('http://localhost:4000/api/admin/system-health', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const reqData = await reqRes.json();
    console.log('System Health:', JSON.stringify(reqData, null, 2));
  } catch (e) {
    console.error(e);
  }
};
run();

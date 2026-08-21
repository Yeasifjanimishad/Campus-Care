import 'dotenv/config';
import fetch from 'node-fetch';
import app from './src/index.js';

const PORT = 4005;

const server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`);
  
  try {
    const res = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'sokal@diu.edu.bd',
        password: 'Password123!'
      })
    });
    
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    server.close();
    process.exit(0);
  }
});

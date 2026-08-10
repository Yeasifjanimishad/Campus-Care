import fetch from 'node-fetch';

async function test() {
  console.log("Fetching doctors...");
  const docRes = await fetch('http://localhost:5000/api/doctors');
  const docs = await docRes.json();
  const doctor = docs.data[0];
  console.log("Doctor:", doctor);

  if (!doctor) {
    console.log("No doctor found");
    return;
  }

  console.log("Creating appointment...");
  const res = await fetch('http://localhost:5000/api/appointments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      doctor_id: doctor.id,
      appointment_date: '2026-08-12',
      start_time: '10:00:00',
      end_time: '10:30:00',
      reason: 'Test Reason'
    })
  });
  const data = await res.json();
  console.log("Response:", data);
}

test();

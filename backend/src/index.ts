import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import authRouter from './routes/auth.js';
import doctorRequestsRouter from './routes/doctorRequests.js';
import doctorsRouter from './routes/doctors.js';
import appointmentsRouter from './routes/appointments.js';
import appointmentRemindersRouter from './routes/appointmentReminders.js';
import sosRouter from './routes/sos.js';
import incidentsRouter from './routes/incidents.js';
import uploadRouter from './routes/upload.js';
import adminRouter from './routes/admin.js';
import auditLogsRouter from './routes/auditLogs.js';
import schedulerRouter from './routes/scheduler.js';
import { setupRealtimeWebSocket } from './routes/realtime.js';
import { startScheduler } from './services/scheduler.js';
import { errorHandler } from './lib/errors.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 3000) : 4000;

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusCare Backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/doctor-requests', doctorRequestsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/appointment-reminders', appointmentRemindersRouter);
app.use('/api/sos', sosRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin/audit-logs', auditLogsRouter);
app.use('/api/admin/scheduler', schedulerRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Setup WebSocket Server
setupRealtimeWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[CampusCare Backend] Server running on port ${PORT}`);
  startScheduler();
});

export default app;

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

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
import systemHealthRouter from './routes/admin/systemHealth.js';
import { setupRealtimeWebSocket } from './routes/realtime.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';
import { defaultRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger, errorLogger } from './middleware/logger.js';
import { errorHandler } from './lib/errors.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 3000) : 4000;

// 1. Security Headers Middleware (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to prevent blocking preview / iframe assets
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. HTTP Compression Middleware
app.use(compression());

// 3. CORS Configuration with specific allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4000',
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production' ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// 4. Request body size limits (10MB for URL-encoded / uploads, 1MB for standard JSON)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Structured Request Logging
app.use(requestLogger);

// 6. Default API Rate Limiter
app.use('/api', defaultRateLimiter);

// 7. Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusCare Backend',
    timestamp: new Date().toISOString(),
  });
});

// 8. Application API Routes
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
app.use('/api/admin/system-health', systemHealthRouter);
app.use('/api/admin', adminRouter);

// 9. Error Logging and Centralized Error Handling
app.use(errorLogger);
app.use(errorHandler);

// 10. Serve frontend static files in production / single-server mode
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// 11. Setup WebSocket Server for Realtime SOS & Appointments
setupRealtimeWebSocket(httpServer);

// 12. Start Server and Cron Scheduler
const serverInstance = httpServer.listen(PORT, () => {
  console.log(`[CampusCare Backend] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  startScheduler();
});

// 13. Graceful Shutdown Handling (SIGTERM & SIGINT)
const handleGracefulShutdown = (signal: string) => {
  console.log(`[CampusCare Backend] Received ${signal}. Initiating graceful shutdown...`);
  stopScheduler();

  serverInstance.close((err) => {
    if (err) {
      console.error('[CampusCare Backend] Error during HTTP server close:', err);
      process.exit(1);
    }
    console.log('[CampusCare Backend] HTTP server closed cleanly. Exiting.');
    process.exit(0);
  });

  // Force exit if connections do not close within 10 seconds
  setTimeout(() => {
    console.error('[CampusCare Backend] Forcing shutdown after 10s timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default app;

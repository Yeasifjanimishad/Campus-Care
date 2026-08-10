import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';

/**
 * Higher-order middleware to validate request body with Zod
 */
export const validateBody = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        const summaryMessage = issues
          .map((i) => (i.field ? `${i.field}: ${i.message}` : i.message))
          .join(', ');

        return res.status(400).json({
          error: {
            message: `Validation failed: ${summaryMessage}`,
            code: 'VALIDATION_ERROR',
            details: issues,
          },
        });
      }
      next(err);
    }
  };
};

/**
 * Higher-order middleware to validate query parameters with Zod
 */
export const validateQuery = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        const summaryMessage = issues
          .map((i) => (i.field ? `${i.field}: ${i.message}` : i.message))
          .join(', ');

        return res.status(400).json({
          error: {
            message: `Query validation failed: ${summaryMessage}`,
            code: 'VALIDATION_ERROR',
            details: issues,
          },
        });
      }
      next(err);
    }
  };
};

/**
 * Higher-order middleware to validate URL parameters with Zod
 */
export const validateParams = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        const summaryMessage = issues
          .map((i) => (i.field ? `${i.field}: ${i.message}` : i.message))
          .join(', ');

        return res.status(400).json({
          error: {
            message: `Parameter validation failed: ${summaryMessage}`,
            code: 'VALIDATION_ERROR',
            details: issues,
          },
        });
      }
      next(err);
    }
  };
};

// ==========================================
// Reusable Zod Validation Schemas
// ==========================================

// --- 1. Auth Schemas ---
export const loginSchema = z.object({
  email: z.string().email('A valid university email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const doctorLoginSchema = z.object({
  doctor_id: z.string().min(1, 'Doctor ID is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const signupSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .refine((val) => val.endsWith('@diu.edu.bd'), {
      message: 'Only @diu.edu.bd institutional email addresses are allowed for signup',
    }),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(2, 'Full name must have at least 2 characters'),
  university_id: z.string().min(1, 'University ID is required'),
  department: z.string().optional(),
  phone: z.string().optional(),
});

// --- 2. Doctor Requests Schemas ---
export const createDoctorRequestSchema = z.object({
  full_name: z.string().min(2, 'Full name must have at least 2 characters'),
  email: z.string().email('A valid email address is required'),
  doctor_id: z.string().min(1, 'Doctor ID reference is required'),
  department: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters long').optional(),
});

export const reviewDoctorRequestSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: 'Status must be either approved or rejected' }),
  }),
  rejection_reason: z.string().optional(),
  assigned_role: z.string().optional(),
});

// --- 3. SOS Alerts Schemas ---
export const createSosSchema = z.object({
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  emergency_type: z.string().default('general').optional(),
  message: z.string().default('').optional(),
});

export const updateSosStatusSchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved', 'false_alarm'], {
    errorMap: () => ({ message: 'Invalid SOS status value' }),
  }),
  notes: z.string().optional(),
});

export const acknowledgeSosSchema = z.object({
  notes: z.string().optional(),
});

export const resolveSosSchema = z.object({
  resolution_notes: z.string().optional(),
});

// --- 4. Appointments Schemas ---
export const createAppointmentSchema = z.object({
  doctor_id: z.string().min(1, 'Doctor ID is required'),
  appointment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  start_time: z.string().min(3, 'Start time is required'),
  end_time: z.string().optional(),
  reason: z.string().min(3, 'Reason for appointment must be at least 3 characters'),
  symptoms: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  student_note: z.string().optional().nullable(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(
    ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'],
    {
      errorMap: () => ({ message: 'Invalid appointment status' }),
    }
  ),
  cancellation_reason: z.string().optional(),
});

export const rescheduleAppointmentSchema = z.object({
  appointment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  start_time: z.string().min(3, 'Start time is required'),
  end_time: z.string().optional(),
  reason: z.string().optional(),
});

// --- 5. Incident Reports Schemas ---
export const createIncidentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  category: z.enum(
    [
      'medical_emergency',
      'accident_injury',
      'mental_health_crisis',
      'hazard_safety',
      'security_concern',
      'other',
    ],
    {
      errorMap: () => ({ message: 'Invalid incident category' }),
    }
  ),
  severity: z.enum(['low', 'medium', 'high', 'critical'], {
    errorMap: () => ({ message: 'Severity must be low, medium, high, or critical' }),
  }),
  location: z.string().min(2, 'Location is required'),
  description: z.string().min(5, 'Description must be at least 5 characters long'),
  involved_persons: z.string().optional(),
  photo_urls: z.array(z.string()).optional(),
});

export const updateIncidentStatusSchema = z.object({
  status: z.enum(
    ['submitted', 'under_review', 'in_progress', 'resolved', 'closed'],
    {
      errorMap: () => ({ message: 'Invalid incident status' }),
    }
  ),
  assigned_to: z.string().optional(),
  resolution_notes: z.string().optional(),
});

// --- 6. Health Records Schemas ---
export const createHealthRecordSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required'),
  doctor_id: z.string().optional(),
  appointment_id: z.string().optional(),
  diagnosis: z.string().min(2, 'Diagnosis must be at least 2 characters'),
  prescription: z.string().optional(),
  notes: z.string().optional(),
  follow_up_date: z.string().optional(),
  vitals: z.record(z.any()).optional(),
});

export const updateHealthRecordSchema = z.object({
  diagnosis: z.string().optional(),
  prescription: z.string().optional(),
  notes: z.string().optional(),
  follow_up_date: z.string().optional(),
  vitals: z.record(z.any()).optional(),
});

// --- 7. Broadcasts Schemas ---
export const createBroadcastSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  message: z.string().min(5, 'Message must be at least 5 characters'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z
    .enum([
      'general',
      'health_alert',
      'emergency',
      'camp_drive',
      'weather_alert',
      'maintenance',
    ])
    .default('general'),
  target_role: z.enum(['all', 'students', 'doctors', 'admins']).default('all'),
  expires_at: z.string().optional(),
});

-- ============================================================================
-- CAMPUSCARE DATABASE SCHEMA (SUPABASE / POSTGRESQL)
-- Complete, Idempotent, and Fully Validated Production Schema
-- Compatible with Supabase SQL Editor execution in a single run
-- ============================================================================

-- 0. Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE HELPER FUNCTIONS (Defined before tables/policies that reference them)
-- ============================================================================

-- Admin Check Helper Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'emergency_admin')
      AND status = 'active'
  );
$$;

-- Super Admin Check Helper Function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
  );
$$;

-- Timestamp update trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. ALL DATABASE TABLES (Created in strict foreign-key dependency order)
-- ============================================================================

-- 1. User Profiles Table (public.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  university_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student_faculty' CHECK (role IN ('student_faculty', 'doctor', 'emergency_admin', 'super_admin')),
  department TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled', 'pending')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Doctor Access Requests Table
CREATE TABLE IF NOT EXISTS public.doctor_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Doctors Table
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  doctor_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  specialization TEXT NOT NULL DEFAULT 'General Medicine',
  designation TEXT DEFAULT 'Consultant Physician',
  phone TEXT,
  room_number TEXT DEFAULT 'Room 101, Medical Center',
  available_days TEXT[] DEFAULT ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  start_time TIME DEFAULT '09:00:00',
  end_time TIME DEFAULT '17:00:00',
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rejected')),
  reason TEXT NOT NULL,
  symptoms TEXT,
  doctor_note TEXT,
  rejection_reason TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SOS Emergency Alerts Table
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latitude NUMERIC,
  longitude NUMERIC,
  accuracy NUMERIC,
  emergency_type TEXT NOT NULL DEFAULT 'medical' CHECK (emergency_type IN ('medical', 'security', 'fire', 'harassment', 'general')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'cancelled')),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Incident Reports Table
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('theft', 'harassment', 'ragging', 'injury', 'facility_damage', 'suspicious_activity', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  incident_time TIME,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'resolved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Health Records Table
CREATE TABLE IF NOT EXISTS public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  diagnosis TEXT NOT NULL,
  prescription TEXT,
  notes TEXT,
  vital_signs JSONB DEFAULT '{}'::jsonb,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Broadcast Announcements Table
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'announcement' CHECK (category IN ('emergency', 'health_alert', 'announcement', 'advisory')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'doctors', 'staff')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  link_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Appointment Reminders Tracking Table
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h', 'followup')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(appointment_id, user_id, reminder_type)
);

-- 12. Scheduler Logs Table
CREATE TABLE IF NOT EXISTS public.scheduler_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'running')),
  records_processed INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  duration_ms INTEGER,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. System Health Events Table
CREATE TABLE IF NOT EXISTS public.system_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  component TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved')),
  details JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Scheduler Task Failures Table
CREATE TABLE IF NOT EXISTS public.scheduler_task_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  stack_trace TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2.1 COLUMN SYNCHRONIZATION & SELF-HEALING (Guarantees compatibility if tables already exist)
-- ============================================================================

-- 1. Users Table Columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student_faculty';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Doctor Access Requests Table Columns
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Doctors Table Columns (Crucial: is_available, available_days, start_time, end_time, etc.)
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS specialization TEXT DEFAULT 'General Medicine';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'Consultant Physician';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS room_number TEXT DEFAULT 'Room 101, Medical Center';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT '09:00:00';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS end_time TIME DEFAULT '17:00:00';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE public.doctors SET is_available = TRUE WHERE is_available IS NULL;

-- Ensure legacy 'name' column (if present from previous schema) is made nullable and synchronized
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'doctors' AND column_name = 'name'
  ) THEN
    BEGIN
      ALTER TABLE public.doctors ALTER COLUMN name DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    UPDATE public.doctors SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;
    UPDATE public.doctors SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- 4. Appointments Table Columns
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_id UUID;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_note TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. SOS Alerts Table Columns
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS accuracy NUMERIC;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS emergency_type TEXT DEFAULT 'medical';
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS acknowledged_by UUID;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS resolved_by UUID;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Incident Reports Table Columns
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_time TIME;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Health Records Table Columns
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS doctor_id UUID;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS appointment_id UUID;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS prescription TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS vital_signs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 8. Broadcasts Table Columns
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS sender_id UUID;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'announcement';
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 9. Notifications Table Columns
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS broadcast_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'delivered';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 10. Admin Audit Logs Table Columns
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS target_user_id UUID;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 11. Appointment Reminders Table Columns
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS appointment_id UUID;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS reminder_type TEXT;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 12. Scheduler Logs Table Columns
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS task_name TEXT;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS records_processed INTEGER DEFAULT 0;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ DEFAULT NOW();

-- 13. System Health Events Table Columns
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS component TEXT;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'warning';
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS resolved_by UUID;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 14. Scheduler Task Failures Table Columns
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS task_name TEXT;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS stack_trace TEXT;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2.2 Ensure Unique Constraints & Unique Indexes Exist for all tables
DO $$
BEGIN
  -- 1. Ensure unique constraint on public.users(email)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key' AND conrelid = 'public.users'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 2. Ensure unique constraint on public.doctors(doctor_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctors_doctor_id_key' AND conrelid = 'public.doctors'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.doctors ADD CONSTRAINT doctors_doctor_id_key UNIQUE (doctor_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 3. Ensure unique constraint on public.doctors(email)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctors_email_key' AND conrelid = 'public.doctors'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.doctors ADD CONSTRAINT doctors_email_key UNIQUE (email);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 4. Ensure unique constraint on public.appointment_reminders(appointment_id, user_id, reminder_type)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_reminders_unique_key' AND conrelid = 'public.appointment_reminders'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.appointment_reminders ADD CONSTRAINT appointment_reminders_unique_key UNIQUE (appointment_id, user_id, reminder_type);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- ============================================================================
-- 3. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON public.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_doctor_id_unique ON public.doctors (doctor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_email_unique ON public.doctors (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_reminders_unique ON public.appointment_reminders (appointment_id, user_id, reminder_type);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users (status);
CREATE INDEX IF NOT EXISTS idx_users_university_id ON public.users (university_id);

CREATE INDEX IF NOT EXISTS idx_doctor_requests_status ON public.doctor_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_doctor_requests_email ON public.doctor_access_requests(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_doctor_requests_docid ON public.doctor_access_requests(doctor_id);

CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON public.doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_available ON public.doctors(is_available);
CREATE INDEX IF NOT EXISTS idx_doctors_email ON public.doctors(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_doctors_department ON public.doctors(department);

CREATE INDEX IF NOT EXISTS idx_appointments_student ON public.appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date, start_time);

CREATE INDEX IF NOT EXISTS idx_sos_status ON public.sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sos_user ON public.sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_created ON public.sos_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_student ON public.incident_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON public.incident_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_records_student ON public.health_records(student_id);
CREATE INDEX IF NOT EXISTS idx_health_records_doctor ON public.health_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_health_records_created ON public.health_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_status_scheduled ON public.appointment_reminders(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_executed ON public.scheduler_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON public.system_health_events(status);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================

-- Enable RLS on all public tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_task_failures ENABLE ROW LEVEL SECURITY;

-- 4.1 public.users Policies
DROP POLICY IF EXISTS "Allow user to read own profile" ON public.users;
CREATE POLICY "Allow user to read own profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Allow user to update own profile" ON public.users;
CREATE POLICY "Allow user to update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Allow authenticated insert during signup" ON public.users;
CREATE POLICY "Allow authenticated insert during signup"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
CREATE POLICY "Admins have full access to users"
  ON public.users FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.2 public.doctor_access_requests Policies
DROP POLICY IF EXISTS "Anyone can insert doctor access requests" ON public.doctor_access_requests;
CREATE POLICY "Anyone can insert doctor access requests"
  ON public.doctor_access_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can select doctor access requests" ON public.doctor_access_requests;
CREATE POLICY "Admins can select doctor access requests"
  ON public.doctor_access_requests FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update doctor access requests" ON public.doctor_access_requests;
CREATE POLICY "Admins can update doctor access requests"
  ON public.doctor_access_requests FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete doctor access requests" ON public.doctor_access_requests;
CREATE POLICY "Admins can delete doctor access requests"
  ON public.doctor_access_requests FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4.3 public.doctors Policies
DROP POLICY IF EXISTS "Anyone can view active doctors" ON public.doctors;
CREATE POLICY "Anyone can view active doctors"
  ON public.doctors FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctors;
CREATE POLICY "Doctors can update their own profile"
  ON public.doctors FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins have full control over doctors" ON public.doctors;
CREATE POLICY "Admins have full control over doctors"
  ON public.doctors FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.4 public.appointments Policies
DROP POLICY IF EXISTS "Students can view own appointments" ON public.appointments;
CREATE POLICY "Students can view own appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() OR
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Students can create appointments" ON public.appointments;
CREATE POLICY "Students can create appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Participants can update appointments" ON public.appointments;
CREATE POLICY "Participants can update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid() OR
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    public.is_admin()
  )
  WITH CHECK (
    student_id = auth.uid() OR
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    public.is_admin()
  );

-- 4.5 public.sos_alerts Policies
DROP POLICY IF EXISTS "Users can view own alerts or admins view all" ON public.sos_alerts;
CREATE POLICY "Users can view own alerts or admins view all"
  ON public.sos_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can create sos alerts" ON public.sos_alerts;
CREATE POLICY "Authenticated users can create sos alerts"
  ON public.sos_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users or admins can update sos alerts" ON public.sos_alerts;
CREATE POLICY "Users or admins can update sos alerts"
  ON public.sos_alerts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 4.6 public.incident_reports Policies
DROP POLICY IF EXISTS "Users can view own incidents or admins view all" ON public.incident_reports;
CREATE POLICY "Users can view own incidents or admins view all"
  ON public.incident_reports FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can submit incident reports" ON public.incident_reports;
CREATE POLICY "Users can submit incident reports"
  ON public.incident_reports FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update incident reports" ON public.incident_reports;
CREATE POLICY "Admins can update incident reports"
  ON public.incident_reports FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.7 public.health_records Policies
DROP POLICY IF EXISTS "Students can view own health records" ON public.health_records;
CREATE POLICY "Students can view own health records"
  ON public.health_records FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() OR
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Doctors or admins can create health records" ON public.health_records;
CREATE POLICY "Doctors or admins can create health records"
  ON public.health_records FOR INSERT TO authenticated
  WITH CHECK (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Doctors or admins can update health records" ON public.health_records;
CREATE POLICY "Doctors or admins can update health records"
  ON public.health_records FOR UPDATE TO authenticated
  USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    public.is_admin()
  )
  WITH CHECK (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    public.is_admin()
  );

-- 4.8 public.broadcasts & public.notifications Policies
DROP POLICY IF EXISTS "Authenticated users can view broadcasts" ON public.broadcasts;
CREATE POLICY "Authenticated users can view broadcasts"
  ON public.broadcasts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can create broadcasts" ON public.broadcasts;
CREATE POLICY "Admins can create broadcasts"
  ON public.broadcasts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins or triggers can insert notifications" ON public.notifications;
CREATE POLICY "Admins or triggers can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4.9 public.admin_audit_logs Policies
DROP POLICY IF EXISTS "Authorized admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Authorized admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR auth.uid() = actor_id);

-- 4.10 Scheduler & System Health Policies
DROP POLICY IF EXISTS "Admins can view appointment reminders" ON public.appointment_reminders;
CREATE POLICY "Admins can view appointment reminders"
  ON public.appointment_reminders FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view scheduler logs" ON public.scheduler_logs;
CREATE POLICY "Admins can view scheduler logs"
  ON public.scheduler_logs FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view system health events" ON public.system_health_events;
CREATE POLICY "Admins can view system health events"
  ON public.system_health_events FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view scheduler failures" ON public.scheduler_task_failures;
CREATE POLICY "Admins can view scheduler failures"
  ON public.scheduler_task_failures FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. AUDIT HELPER RPC FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_admin_audit(
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_log_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to write audit log entry.';
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    target_user_id,
    metadata
  ) VALUES (
    v_actor_id,
    p_action,
    p_target_user_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- 6. DOCTOR REGISTRATION & ACCESS MANAGEMENT RPC FUNCTIONS
-- ============================================================================

-- Duplicate Check RPC
CREATE OR REPLACE FUNCTION public.check_doctor_request_exists(
  p_email TEXT,
  p_doctor_id TEXT
)
RETURNS TABLE (
  exists_pending BOOLEAN,
  exists_approved BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email_clean TEXT := LOWER(TRIM(p_email));
  v_doc_id_clean TEXT := TRIM(p_doctor_id);
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS (
      SELECT 1 FROM public.doctor_access_requests
      WHERE status = 'pending'
        AND (LOWER(email) = v_email_clean OR doctor_id = v_doc_id_clean)
    ) AS exists_pending,
    EXISTS (
      SELECT 1 FROM public.doctor_access_requests
      WHERE status = 'approved'
        AND (LOWER(email) = v_email_clean OR doctor_id = v_doc_id_clean)
    ) AS exists_approved;
END;
$$;

-- Admin Approval RPC
CREATE OR REPLACE FUNCTION public.approve_doctor_access_request(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_req RECORD;
  v_user_id UUID;
  v_doc_id UUID;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Super Admin privileges required.';
  END IF;

  -- 2. Fetch pending request
  SELECT * INTO v_req
  FROM public.doctor_access_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request % not found or already processed.', p_request_id;
  END IF;

  -- 3. Mark request as approved
  UPDATE public.doctor_access_requests
  SET 
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = v_admin_id,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- 4. Check if user profile already exists
  SELECT id INTO v_user_id FROM public.users WHERE LOWER(email) = LOWER(v_req.email);

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users
    SET 
      role = 'doctor',
      name = v_req.full_name,
      university_id = v_req.doctor_id,
      department = v_req.department,
      phone = COALESCE(v_req.phone, phone),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- 5. Upsert doctor catalog record
  SELECT id INTO v_doc_id FROM public.doctors WHERE doctor_id = v_req.doctor_id OR LOWER(email) = LOWER(v_req.email);

  IF v_doc_id IS NOT NULL THEN
    UPDATE public.doctors
    SET 
      user_id = COALESCE(v_user_id, user_id),
      full_name = v_req.full_name,
      email = v_req.email,
      department = COALESCE(NULLIF(TRIM(v_req.department), ''), 'Medical Center'),
      specialization = COALESCE(NULLIF(TRIM(v_req.department), ''), 'General Medicine'),
      phone = COALESCE(v_req.phone, phone),
      is_available = TRUE,
      updated_at = NOW()
    WHERE id = v_doc_id;
  ELSE
    INSERT INTO public.doctors (
      user_id,
      doctor_id,
      full_name,
      email,
      department,
      specialization,
      designation,
      phone,
      room_number,
      available_days,
      start_time,
      end_time,
      is_available
    ) VALUES (
      v_user_id,
      v_req.doctor_id,
      v_req.full_name,
      v_req.email,
      COALESCE(NULLIF(TRIM(v_req.department), ''), 'Medical Center'),
      COALESCE(NULLIF(TRIM(v_req.department), ''), 'General Medicine'),
      'Consultant Physician',
      COALESCE(v_req.phone, '+880 1700-000000'),
      'Room 101, Medical Center',
      ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']::TEXT[],
      '09:00:00'::TIME,
      '17:00:00'::TIME,
      TRUE
    )
    RETURNING id INTO v_doc_id;
  END IF;

  -- Maintain backward compatibility if legacy 'name' column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'doctors' AND column_name = 'name'
  ) THEN
    BEGIN
      EXECUTE 'UPDATE public.doctors SET name = $1 WHERE id = $2' USING v_req.full_name, v_doc_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 6. Record audit log entry
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    target_user_id,
    metadata
  ) VALUES (
    v_admin_id,
    'doctor_approved',
    v_user_id,
    jsonb_build_object(
      'doctor_id', v_req.doctor_id,
      'email', v_req.email,
      'full_name', v_req.full_name,
      'department', v_req.department
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'doctor_id', v_doc_id,
    'user_id', v_user_id,
    'email', v_req.email,
    'message', 'Doctor access approved successfully.'
  );
END;
$$;

-- Admin Rejection RPC
CREATE OR REPLACE FUNCTION public.reject_doctor_access_request(
  p_request_id UUID,
  p_review_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Super Admin privileges required.';
  END IF;

  SELECT * INTO v_req
  FROM public.doctor_access_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request % not found or already processed.', p_request_id;
  END IF;

  UPDATE public.doctor_access_requests
  SET 
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = v_admin_id,
    review_note = p_review_note,
    updated_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    metadata
  ) VALUES (
    v_admin_id,
    'doctor_rejected',
    jsonb_build_object(
      'request_id', p_request_id,
      'doctor_id', v_req.doctor_id,
      'email', v_req.email,
      'reason', p_review_note
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'message', 'Doctor access request rejected.'
  );
END;
$$;

-- ============================================================================
-- 7. APPOINTMENTS RPC FUNCTIONS
-- ============================================================================

-- Create Appointment RPC
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_doctor_id UUID,
  p_appointment_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_reason TEXT,
  p_symptoms TEXT DEFAULT NULL,
  p_student_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID;
  v_doctor public.doctors%ROWTYPE;
  v_conflict_count INTEGER;
  v_new_appointment_id UUID;
BEGIN
  -- 1. Determine student ID
  IF p_student_id IS NOT NULL AND public.is_admin() THEN
    v_student_id := p_student_id::UUID;
  ELSE
    v_student_id := auth.uid();
  END IF;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to book an appointment.';
  END IF;

  -- 2. Validate doctor exists and is available
  SELECT * INTO v_doctor FROM public.doctors WHERE (id = p_doctor_id OR user_id = p_doctor_id) AND is_available = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected doctor is not available for appointments.';
  END IF;

  -- 3. Validate times
  IF p_appointment_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot schedule appointments in the past.';
  END IF;

  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Start time must precede end time.';
  END IF;

  -- 4. Check for overlapping appointments
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments
  WHERE doctor_id = v_doctor.id
    AND appointment_date = p_appointment_date
    AND status IN ('pending', 'confirmed')
    AND (
      (start_time <= p_start_time AND end_time > p_start_time) OR
      (start_time < p_end_time AND end_time >= p_end_time) OR
      (start_time >= p_start_time AND end_time <= p_end_time)
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'The selected time slot is already booked. Please choose another time.';
  END IF;

  -- 5. Insert new appointment
  INSERT INTO public.appointments (
    student_id,
    doctor_id,
    appointment_date,
    date,
    start_time,
    end_time,
    time_slot,
    status,
    reason,
    symptoms
  ) VALUES (
    v_student_id,
    v_doctor.id,
    p_appointment_date,
    p_appointment_date,
    p_start_time,
    p_end_time,
    to_char(p_start_time, 'HH24:MI') || ' - ' || to_char(p_end_time, 'HH24:MI'),
    'pending',
    TRIM(p_reason),
    TRIM(p_symptoms)
  ) RETURNING id INTO v_new_appointment_id;

  -- Create in-app notification for the doctor user if registered
  IF v_doctor.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      category,
      priority,
      delivery_status,
      link_url
    ) VALUES (
      v_doctor.user_id,
      'New Appointment Request',
      'You have a new appointment booking for ' || to_char(p_appointment_date, 'YYYY-MM-DD') || ' at ' || to_char(p_start_time, 'HH24:MI'),
      'health_alert',
      'high',
      'delivered',
      'appointments'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_appointment_id,
    'appointment_id', v_new_appointment_id,
    'message', 'Appointment created successfully.'
  );
END;
$$;

-- Cancel Appointment RPC
CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_appt RECORD;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment % not found.', p_appointment_id;
  END IF;

  IF v_appt.student_id <> v_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: You can only cancel your own appointments.';
  END IF;

  IF v_appt.status IN ('completed', 'cancelled', 'rejected') THEN
    RAISE EXCEPTION 'Appointment is already % and cannot be cancelled.', v_appt.status;
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$;

-- Get Booked Slots RPC
CREATE OR REPLACE FUNCTION public.get_booked_slots(
  p_doctor_id UUID,
  p_appointment_date DATE
)
RETURNS TABLE (
  start_time TIME,
  end_time TIME,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT start_time, end_time, status
  FROM public.appointments
  WHERE doctor_id = p_doctor_id
    AND appointment_date = p_appointment_date
    AND status IN ('pending', 'confirmed');
$$;

-- Confirm Appointment RPC
CREATE OR REPLACE FUNCTION public.confirm_appointment(
  p_appointment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_appt RECORD;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found.';
  END IF;

  UPDATE public.appointments
  SET status = 'confirmed', updated_at = NOW()
  WHERE id = p_appointment_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority,
    delivery_status,
    link_url
  ) VALUES (
    v_appt.student_id,
    'Appointment Confirmed',
    'Your medical appointment on ' || to_char(v_appt.appointment_date, 'YYYY-MM-DD') || ' has been confirmed.',
    'health_alert',
    'high',
    'delivered',
    'appointments'
  );

  RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$;

-- Complete Appointment RPC
CREATE OR REPLACE FUNCTION public.complete_appointment(
  p_appointment_id UUID,
  p_doctor_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt RECORD;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found.';
  END IF;

  UPDATE public.appointments
  SET status = 'completed', doctor_note = p_doctor_note, updated_at = NOW()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$;

-- Reject Appointment RPC
CREATE OR REPLACE FUNCTION public.reject_appointment(
  p_appointment_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt RECORD;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found.';
  END IF;

  UPDATE public.appointments
  SET status = 'rejected', rejection_reason = p_rejection_reason, updated_at = NOW()
  WHERE id = p_appointment_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority,
    delivery_status
  ) VALUES (
    v_appt.student_id,
    'Appointment Declined',
    'Your appointment request was declined. Reason: ' || COALESCE(p_rejection_reason, 'Schedule conflict'),
    'health_alert',
    'normal',
    'delivered'
  );

  RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$;

-- ============================================================================
-- 8. SOS EMERGENCY SYSTEM RPC FUNCTIONS
-- ============================================================================

-- Create SOS Alert RPC
CREATE OR REPLACE FUNCTION public.create_sos_alert(
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL,
  p_emergency_type TEXT DEFAULT 'medical',
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_alert RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to trigger an SOS alert.';
  END IF;

  INSERT INTO public.sos_alerts (
    user_id,
    latitude,
    longitude,
    accuracy,
    emergency_type,
    message,
    status
  ) VALUES (
    v_user_id,
    p_latitude,
    p_longitude,
    p_accuracy,
    p_emergency_type,
    p_message,
    'active'
  )
  RETURNING * INTO v_new_alert;

  RETURN jsonb_build_object('success', true, 'alert', row_to_json(v_new_alert));
END;
$$;

-- Acknowledge SOS Alert RPC
CREATE OR REPLACE FUNCTION public.acknowledge_sos_alert(
  p_alert_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  UPDATE public.sos_alerts
  SET 
    status = 'acknowledged',
    acknowledged_at = NOW(),
    acknowledged_by = v_admin_id,
    updated_at = NOW()
  WHERE id = p_alert_id;

  RETURN jsonb_build_object('success', true, 'alert_id', p_alert_id);
END;
$$;

-- Resolve SOS Alert RPC
CREATE OR REPLACE FUNCTION public.resolve_sos_alert(
  p_alert_id UUID,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  UPDATE public.sos_alerts
  SET 
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = v_admin_id,
    resolution_note = p_resolution_note,
    updated_at = NOW()
  WHERE id = p_alert_id;

  RETURN jsonb_build_object('success', true, 'alert_id', p_alert_id);
END;
$$;

-- Cancel SOS Alert RPC
CREATE OR REPLACE FUNCTION public.cancel_sos_alert(
  p_alert_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE public.sos_alerts
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_alert_id AND (user_id = v_user_id OR public.is_admin());

  RETURN jsonb_build_object('success', true, 'alert_id', p_alert_id);
END;
$$;

-- ============================================================================
-- 9. INCIDENT REPORTING RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_incident_report(
  p_category TEXT,
  p_title TEXT,
  p_description TEXT,
  p_location TEXT DEFAULT NULL,
  p_incident_date DATE DEFAULT CURRENT_DATE,
  p_incident_time TIME DEFAULT NULL,
  p_evidence_urls TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_new_report RECORD;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit an incident report.';
  END IF;

  INSERT INTO public.incident_reports (
    student_id,
    category,
    title,
    description,
    location,
    incident_date,
    incident_time,
    evidence_urls,
    status
  ) VALUES (
    v_student_id,
    p_category,
    p_title,
    p_description,
    p_location,
    p_incident_date,
    p_incident_time,
    p_evidence_urls,
    'submitted'
  )
  RETURNING * INTO v_new_report;

  RETURN jsonb_build_object('success', true, 'report', row_to_json(v_new_report));
END;
$$;

CREATE OR REPLACE FUNCTION public.review_incident_report(
  p_report_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  UPDATE public.incident_reports
  SET 
    status = 'under_review',
    reviewed_at = NOW(),
    reviewed_by = v_admin_id,
    updated_at = NOW()
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_incident_report(
  p_report_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  UPDATE public.incident_reports
  SET 
    status = 'resolved',
    reviewed_at = NOW(),
    reviewed_by = v_admin_id,
    admin_note = p_admin_note,
    updated_at = NOW()
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_incident_report(
  p_report_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  UPDATE public.incident_reports
  SET 
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = v_admin_id,
    admin_note = p_admin_note,
    updated_at = NOW()
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id);
END;
$$;

-- ============================================================================
-- 10. HEALTH RECORDS & BROADCAST RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_health_record(
  p_student_id UUID,
  p_diagnosis TEXT,
  p_doctor_id UUID DEFAULT NULL,
  p_prescription TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_vital_signs JSONB DEFAULT '{}'::jsonb,
  p_attachments TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_record RECORD;
BEGIN
  IF NOT public.is_admin() AND NOT EXISTS(SELECT 1 FROM public.doctors WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Doctor or Admin role required.';
  END IF;

  INSERT INTO public.health_records (
    student_id,
    doctor_id,
    diagnosis,
    prescription,
    notes,
    vital_signs,
    attachments
  ) VALUES (
    p_student_id,
    p_doctor_id,
    p_diagnosis,
    p_prescription,
    p_notes,
    COALESCE(p_vital_signs, '{}'::jsonb),
    COALESCE(p_attachments, '{}')
  )
  RETURNING * INTO v_new_record;

  RETURN jsonb_build_object('success', true, 'record', row_to_json(v_new_record));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_broadcast(
  p_title TEXT,
  p_message TEXT,
  p_category TEXT DEFAULT 'announcement',
  p_target_audience TEXT DEFAULT 'all',
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_new_broadcast RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  INSERT INTO public.broadcasts (
    sender_id,
    title,
    message,
    category,
    target_audience,
    priority
  ) VALUES (
    v_sender_id,
    p_title,
    p_message,
    p_category,
    p_target_audience,
    p_priority
  )
  RETURNING * INTO v_new_broadcast;

  -- Fan out notifications to target users
  INSERT INTO public.notifications (
    user_id,
    broadcast_id,
    title,
    message,
    category,
    priority,
    delivery_status
  )
  SELECT 
    id,
    v_new_broadcast.id,
    p_title,
    p_message,
    p_category,
    p_priority,
    'delivered'
  FROM public.users
  WHERE status = 'active'
    AND (
      p_target_audience = 'all' OR
      (p_target_audience = 'students' AND role = 'student_faculty') OR
      (p_target_audience = 'doctors' AND role = 'doctor')
    );

  RETURN jsonb_build_object('success', true, 'broadcast', row_to_json(v_new_broadcast));
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND (user_id = auth.uid() OR public.is_admin());

  RETURN jsonb_build_object('success', true, 'notification_id', p_notification_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INT;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = v_user_id AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- ============================================================================
-- 11. USER ROLE MANAGEMENT & SUPER ADMIN STATS RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id UUID,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super Admin privileges required.';
  END IF;

  UPDATE public.users
  SET role = p_role, updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_logs (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'ROLE_CHANGE', p_user_id, jsonb_build_object('new_role', p_role));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'new_role', p_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_status(
  p_user_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  UPDATE public.users
  SET status = p_status, updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_logs (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'STATUS_CHANGE', p_user_id, jsonb_build_object('new_status', p_status));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'new_status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_super_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.users),
    'students_faculty', (SELECT COUNT(*) FROM public.users WHERE role = 'student_faculty'),
    'doctors', (SELECT COUNT(*) FROM public.users WHERE role = 'doctor'),
    'emergency_admins', (SELECT COUNT(*) FROM public.users WHERE role = 'emergency_admin'),
    'super_admins', (SELECT COUNT(*) FROM public.users WHERE role = 'super_admin'),
    'active_users', (SELECT COUNT(*) FROM public.users WHERE status = 'active'),
    'suspended_users', (SELECT COUNT(*) FROM public.users WHERE status = 'suspended'),
    'pending_doctor_requests', (SELECT COUNT(*) FROM public.doctor_access_requests WHERE status = 'pending'),
    'active_sos_alerts', (SELECT COUNT(*) FROM public.sos_alerts WHERE status IN ('active', 'acknowledged')),
    'today_appointments', (SELECT COUNT(*) FROM public.appointments WHERE appointment_date = CURRENT_DATE),
    'today_incidents', (SELECT COUNT(*) FROM public.incident_reports WHERE incident_date = CURRENT_DATE),
    'total_broadcasts', (SELECT COUNT(*) FROM public.broadcasts),
    'total_health_records', (SELECT COUNT(*) FROM public.health_records)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- ============================================================================
-- 12. SCHEDULER & SYSTEM HEALTH RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_scheduled_tasks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reminders_count INT := 0;
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_duration INT;
BEGIN
  -- Insert 24h reminders for upcoming appointments tomorrow
  INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for, status)
  SELECT 
    a.id,
    a.student_id,
    '24h',
    (a.appointment_date + a.start_time - INTERVAL '24 hours'),
    'pending'
  FROM public.appointments a
  WHERE a.status = 'confirmed'
    AND a.appointment_date = (CURRENT_DATE + INTERVAL '1 day')
    AND NOT EXISTS (
      SELECT 1 FROM public.appointment_reminders ar
      WHERE ar.appointment_id = a.id
        AND ar.user_id = a.student_id
        AND ar.reminder_type = '24h'
    );

  GET DIAGNOSTICS v_reminders_count = ROW_COUNT;

  v_duration := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;

  INSERT INTO public.scheduler_logs (task_name, status, records_processed, duration_ms)
  VALUES ('DAILY_REMINDER_GENERATION', 'success', v_reminders_count, v_duration);

  RETURN jsonb_build_object('success', true, 'reminders_generated', v_reminders_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_health JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  SELECT jsonb_build_object(
    'db_status', 'healthy',
    'active_sos_count', (SELECT COUNT(*) FROM public.sos_alerts WHERE status IN ('active', 'acknowledged')),
    'pending_requests_count', (SELECT COUNT(*) FROM public.doctor_access_requests WHERE status = 'pending'),
    'unresolved_events_count', (SELECT COUNT(*) FROM public.system_health_events WHERE status = 'active'),
    'timestamp', NOW()
  ) INTO v_health;

  RETURN v_health;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_system_health_event(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  UPDATE public.system_health_events
  SET status = 'resolved', resolved_at = NOW(), resolved_by = auth.uid()
  WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', p_event_id);
END;
$$;

-- ============================================================================
-- 13. TRIGGERS
-- ============================================================================

-- Updated_at triggers
DROP TRIGGER IF EXISTS tr_users_updated_at ON public.users;
CREATE TRIGGER tr_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_doctors_updated_at ON public.doctors;
CREATE TRIGGER tr_doctors_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_appointments_updated_at ON public.appointments;
CREATE TRIGGER tr_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_doctor_requests_updated_at ON public.doctor_access_requests;
CREATE TRIGGER tr_doctor_requests_updated_at
  BEFORE UPDATE ON public.doctor_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Role protection trigger for new signups
CREATE OR REPLACE FUNCTION public.enforce_user_signup_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_approved BOOLEAN := FALSE;
BEGIN
  IF NEW.role = 'doctor' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.doctor_access_requests
      WHERE LOWER(email) = LOWER(NEW.email) AND status = 'approved'
    ) INTO v_is_approved;

    IF NOT v_is_approved AND NOT public.is_admin() THEN
      NEW.role := 'student_faculty';
    END IF;
  ELSIF NEW.role IN ('super_admin', 'emergency_admin') THEN
    IF NOT public.is_admin() THEN
      -- First user created in system can become super_admin
      IF (SELECT COUNT(*) FROM public.users WHERE id <> NEW.id) > 0 THEN
        NEW.role := 'student_faculty';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_user_signup_role ON public.users;
CREATE TRIGGER tr_enforce_user_signup_role
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_signup_role();

-- ============================================================================
-- 14. GRANTS & SECURITY PRIVILEGES
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- 15. DOCTOR ONBOARDING WORKFLOW (ZERO MOCK DATA)
-- Doctors submit requests via public.doctor_access_requests and are verified
-- and approved by Super Admins via approve_doctor_access_request().
-- ============================================================================

-- ============================================================================
-- 16. SAFE STORAGE BUCKET INITIALIZATION
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'incident-evidence') THEN
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('incident-evidence', 'incident-evidence', false);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================================
-- 17. SAFE SUPABASE REALTIME PUBLICATION SETUP
-- ============================================================================

DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sos_alerts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'incident_reports'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_reports;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'broadcasts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL; 
END $$;

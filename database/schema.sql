-- CampusCare Supabase Schema: Doctor Access Requests, Doctors Table & Security
-- Run this in the Supabase SQL Editor to enforce strict RLS and database security.

-- ============================================================================
-- STEP 1: User Profiles Table (public.users) + Admin Helper Function
-- ============================================================================
-- Dependency: Linked directly to Supabase Auth (auth.users.id).
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student_faculty' CHECK (role IN ('student_faculty', 'doctor', 'emergency_admin', 'super_admin')),
  university_id TEXT,
  department TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safety net: relax any legacy NOT NULL column on public.users that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'email', 'name', 'role', 'university_id', 'department', 'phone', 'status', 'created_at', 'updated_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.users ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: users.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.users already existed with a different/older shape.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student_faculty';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE public.users SET email = '' WHERE email IS NULL;
ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;
UPDATE public.users SET name = '' WHERE name IS NULL;
ALTER TABLE public.users ALTER COLUMN name SET NOT NULL;


CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and doctors can view user profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can manage user profiles" ON public.users;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins and doctors can view user profiles"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'emergency_admin', 'doctor')
    )
  );

-- Helper Function: is_admin() — must be defined before any policy uses it.
-- (This was originally defined further down the file, after several policies
-- already referenced it, which caused: ERROR 42883 function public.is_admin()
-- does not exist. It now lives here, immediately before its first use.)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'emergency_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE POLICY "Admins can manage user profiles"
  ON public.users FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- STEP 2: Doctor Access Requests Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.doctor_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  department TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  review_note TEXT
);

-- Safety net: relax any legacy NOT NULL column on public.doctor_access_requests that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'full_name', 'email', 'doctor_id', 'department', 'phone', 'message', 'status', 'created_at', 'reviewed_at', 'reviewed_by', 'review_note'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'doctor_access_requests'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.doctor_access_requests ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: doctor_access_requests.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.doctor_access_requests already existed with a different/older shape.
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.doctor_access_requests ADD COLUMN IF NOT EXISTS review_note TEXT;
UPDATE public.doctor_access_requests SET full_name = '' WHERE full_name IS NULL;
ALTER TABLE public.doctor_access_requests ALTER COLUMN full_name SET NOT NULL;
UPDATE public.doctor_access_requests SET email = '' WHERE email IS NULL;
ALTER TABLE public.doctor_access_requests ALTER COLUMN email SET NOT NULL;
UPDATE public.doctor_access_requests SET doctor_id = '' WHERE doctor_id IS NULL;
ALTER TABLE public.doctor_access_requests ALTER COLUMN doctor_id SET NOT NULL;
UPDATE public.doctor_access_requests SET department = '' WHERE department IS NULL;
ALTER TABLE public.doctor_access_requests ALTER COLUMN department SET NOT NULL;

-- Partial unique indexes to prevent duplicate active pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_access_pending_email 
  ON public.doctor_access_requests (LOWER(email)) 
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_access_pending_doctor_id 
  ON public.doctor_access_requests (doctor_id) 
  WHERE status = 'pending';

-- 2. Create public.doctors Table
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  doctor_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  specialization TEXT NOT NULL,
  phone TEXT,
  designation TEXT DEFAULT 'Consultant Physician',
  bio TEXT,
  profile_image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safety net: relax any legacy NOT NULL column on public.doctors that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'user_id', 'doctor_id', 'full_name', 'email', 'department', 'specialization', 'phone', 'designation', 'bio', 'profile_image_url', 'is_available', 'created_at', 'updated_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'doctors'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.doctors ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: doctors.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.doctors already existed with a different/older shape.
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'Consultant Physician';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE public.doctors SET doctor_id = '' WHERE doctor_id IS NULL;
ALTER TABLE public.doctors ALTER COLUMN doctor_id SET NOT NULL;
UPDATE public.doctors SET full_name = '' WHERE full_name IS NULL;
ALTER TABLE public.doctors ALTER COLUMN full_name SET NOT NULL;
UPDATE public.doctors SET email = '' WHERE email IS NULL;
ALTER TABLE public.doctors ALTER COLUMN email SET NOT NULL;
UPDATE public.doctors SET department = '' WHERE department IS NULL;
ALTER TABLE public.doctors ALTER COLUMN department SET NOT NULL;
UPDATE public.doctors SET specialization = '' WHERE specialization IS NULL;
ALTER TABLE public.doctors ALTER COLUMN specialization SET NOT NULL;


-- Indexes for performance and appointment discovery queries
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON public.doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_department ON public.doctors(department);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON public.doctors(specialization);
CREATE INDEX IF NOT EXISTS idx_doctors_is_available ON public.doctors(is_available);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_doctor_id ON public.doctors(doctor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_email ON public.doctors(LOWER(email));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_doctors_updated_at ON public.doctors;
CREATE TRIGGER tr_doctors_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable RLS on doctor_access_requests
ALTER TABLE public.doctor_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for doctor access requests" ON public.doctor_access_requests;
DROP POLICY IF EXISTS "Admins can update doctor access requests" ON public.doctor_access_requests;
DROP POLICY IF EXISTS "Anyone can submit doctor access request" ON public.doctor_access_requests;
DROP POLICY IF EXISTS "Admins can select doctor access requests" ON public.doctor_access_requests;

-- INSERT: Anyone (including unauthenticated public visitors) can submit a request
CREATE POLICY "Anyone can submit doctor access request" 
  ON public.doctor_access_requests 
  FOR INSERT 
  WITH CHECK (
    full_name IS NOT NULL AND length(trim(full_name)) > 0 AND
    email IS NOT NULL AND length(trim(email)) > 0 AND
    doctor_id IS NOT NULL AND length(trim(doctor_id)) > 0 AND
    department IS NOT NULL AND length(trim(department)) > 0
  );

-- SELECT: STRICTLY RESTRICTED to authenticated university admins only
CREATE POLICY "Admins can select doctor access requests" 
  ON public.doctor_access_requests 
  FOR SELECT 
  TO authenticated
  USING (public.is_admin());

-- UPDATE: STRICTLY RESTRICTED to authenticated university admins only
CREATE POLICY "Admins can update doctor access requests" 
  ON public.doctor_access_requests 
  FOR UPDATE 
  TO authenticated
  USING (public.is_admin());

-- 5. Enable RLS on public.doctors
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view doctors" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update own profile" ON public.doctors;
DROP POLICY IF EXISTS "Admins have full access to doctors" ON public.doctors;

-- SELECT: Authenticated users (Students, Doctors, Admins) can discover doctors
CREATE POLICY "Authenticated users can view doctors"
  ON public.doctors
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: Doctors can update their own doctor record (or admins can update any)
CREATE POLICY "Doctors can update own profile"
  ON public.doctors
  FOR UPDATE
  TO authenticated
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR public.is_admin()
  )
  WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR public.is_admin()
  );

-- ALL Operations for Admins
CREATE POLICY "Admins have full access to doctors"
  ON public.doctors
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. RPC Function: Secure Duplicate Checking without exposing request records
CREATE OR REPLACE FUNCTION public.check_doctor_request_exists(
  p_email TEXT,
  p_doctor_id TEXT DEFAULT ''
)
RETURNS TABLE(
  exists_pending BOOLEAN,
  exists_approved BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pending BOOLEAN := FALSE;
  v_approved BOOLEAN := FALSE;
  v_clean_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_doc_id TEXT := TRIM(COALESCE(p_doctor_id, ''));
BEGIN
  SELECT 
    EXISTS(
      SELECT 1 FROM public.doctor_access_requests 
      WHERE status = 'pending' 
      AND (
        (v_clean_email <> '' AND LOWER(email) = v_clean_email) 
        OR 
        (v_clean_doc_id <> '' AND doctor_id = v_clean_doc_id)
      )
    ),
    EXISTS(
      SELECT 1 FROM public.doctor_access_requests 
      WHERE status = 'approved' 
      AND (
        (v_clean_email <> '' AND LOWER(email) = v_clean_email) 
        OR 
        (v_clean_doc_id <> '' AND doctor_id = v_clean_doc_id)
      )
    )
  INTO v_pending, v_approved;

  RETURN QUERY SELECT v_pending, v_approved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_doctor_request_exists(TEXT, TEXT) TO anon, authenticated;

-- 7. RPC Function: Atomic Admin Approval & Doctor Profile Creation
CREATE OR REPLACE FUNCTION public.approve_doctor_access_request(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_user_id UUID;
BEGIN
  -- 1. Verify caller is an authorized admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only university admins can approve doctor access requests.';
  END IF;

  -- 2. Fetch the pending request with row locking
  SELECT * INTO v_req
  FROM public.doctor_access_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or is no longer pending.';
  END IF;

  -- 3. Mark request as approved
  UPDATE public.doctor_access_requests
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE id = p_request_id;

  -- 4. Create or update user profile with 'doctor' role in public.users
  SELECT id INTO v_user_id FROM public.users WHERE LOWER(email) = LOWER(v_req.email);

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users
    SET 
      role = 'doctor',
      name = v_req.full_name,
      university_id = v_req.doctor_id,
      department = v_req.department,
      phone = COALESCE(v_req.phone, phone)
    WHERE id = v_user_id;
  ELSE
    INSERT INTO public.users (
      name,
      email,
      university_id,
      role,
      department,
      phone
    ) VALUES (
      v_req.full_name,
      LOWER(v_req.email),
      v_req.doctor_id,
      'doctor',
      v_req.department,
      v_req.phone
    )
    RETURNING id INTO v_user_id;
  END IF;

  -- 5. Create or update doctor record in public.doctors
  INSERT INTO public.doctors (
    user_id,
    doctor_id,
    full_name,
    email,
    department,
    specialization,
    phone,
    designation,
    is_available
  ) VALUES (
    v_user_id,
    v_req.doctor_id,
    v_req.full_name,
    LOWER(v_req.email),
    v_req.department,
    'General Medicine',
    v_req.phone,
    'Consultant Physician',
    true
  )
  ON CONFLICT (doctor_id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, doctors.user_id),
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    phone = COALESCE(EXCLUDED.phone, doctors.phone),
    updated_at = now();

  -- 6. Record audit log entry
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    target_user_id,
    metadata
  ) VALUES (
    auth.uid(),
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
    'message', 'Doctor request approved and doctor role + profile assigned successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_doctor_access_request(UUID) TO authenticated;

-- 8. RPC Function: Atomic Admin Rejection
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
  v_req RECORD;
BEGIN
  -- 1. Verify caller is an authorized admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only university admins can reject doctor access requests.';
  END IF;

  -- 2. Fetch the pending request with row locking
  SELECT * INTO v_req
  FROM public.doctor_access_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or is no longer pending.';
  END IF;

  -- 3. Mark request as rejected
  UPDATE public.doctor_access_requests
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_note = COALESCE(p_review_note, 'Access request rejected by university administration.')
  WHERE id = p_request_id;

  -- 4. Record audit log entry
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    target_user_id,
    metadata
  ) VALUES (
    auth.uid(),
    'doctor_rejected',
    (SELECT id FROM public.users WHERE LOWER(email) = LOWER(v_req.email)),
    jsonb_build_object(
      'doctor_id', v_req.doctor_id,
      'email', v_req.email,
      'full_name', v_req.full_name,
      'review_note', p_review_note
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Doctor request rejected successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_doctor_access_request(UUID, TEXT) TO authenticated;

-- 9. Triggers on public.users to prevent client-side role elevation
CREATE OR REPLACE FUNCTION public.protect_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_user_role ON public.users;
CREATE TRIGGER tr_protect_user_role
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_role_change();

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
      IF (SELECT COUNT(*) FROM public.users) > 0 THEN
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
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_signup_role();

-- 10. Seed Dataset: 6 Fictional DIU Campus Doctors
INSERT INTO public.doctors (
  doctor_id,
  full_name,
  email,
  department,
  specialization,
  designation,
  phone,
  bio,
  is_available,
  profile_image_url
) VALUES
(
  'DOC-2001',
  'Dr. Ayesha Rahman',
  'ayesha.medical@diu.edu.bd',
  'Medical Center',
  'General Medicine',
  'Chief Medical Officer',
  '+880 1711-001122',
  'Experienced Chief Medical Officer providing comprehensive primary healthcare and preventive medicine to campus students and faculty.',
  true,
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300'
),
(
  'DOC-2002',
  'Dr. Tanvir Ahmed',
  'tanvir.psych@diu.edu.bd',
  'Counseling Unit',
  'Psychiatry & Mental Health',
  'Senior Clinical Consultant',
  '+880 1819-334455',
  'Specialist in student mental health, stress management, cognitive therapy, and adolescent psychological support.',
  true,
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300'
),
(
  'DOC-2003',
  'Dr. Nusrat Jahan',
  'nusrat.derm@diu.edu.bd',
  'Health Center',
  'Dermatology & Wellness',
  'Consultant Dermatologist',
  '+880 1912-556677',
  'Expert in skin health, allergic conditions, wellness counseling, and clinical allergy management.',
  true,
  'https://images.unsplash.com/photo-1594824813566-88855ce78961?auto=format&fit=crop&q=80&w=300'
),
(
  'DOC-2004',
  'Dr. Fahim Hasan',
  'fahim.emergency@diu.edu.bd',
  'Emergency & Care Unit',
  'Emergency Medicine',
  'On-Call Emergency Lead',
  '+880 1515-778899',
  'Specialized emergency responder overseeing campus 24/7 SOS triage, trauma stabilization, and critical care.',
  true,
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=300'
),
(
  'DOC-2005',
  'Dr. Sadia Karim',
  'sadia.gyn@diu.edu.bd',
  'Student Care Clinic',
  'Gynecology & Reproductive Health',
  'Medical Specialist',
  '+880 1616-990011',
  'Dedicated practitioner focusing on reproductive health, female wellness, and general student care.',
  true,
  'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=300'
),
(
  'DOC-2006',
  'Dr. Mahmudul Alam',
  'mahmud.ortho@diu.edu.bd',
  'Sports & Health Center',
  'Orthopedics & Sports Medicine',
  'Senior Sports Physician',
  '+880 1718-223344',
  'Specialist in athletic injuries, joint care, physical rehabilitation, and sports medicine for university athletes.',
  false,
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=300'
)
ON CONFLICT (doctor_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  specialization = EXCLUDED.specialization,
  designation = EXCLUDED.designation,
  phone = EXCLUDED.phone,
  bio = EXCLUDED.bio,
  is_available = EXCLUDED.is_available,
  profile_image_url = EXCLUDED.profile_image_url,
  updated_at = now();

-- 11. Appointments Schema & Security (Step 4)
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT NOT NULL,
  symptoms TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected')),
  student_note TEXT,
  doctor_note TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safety net: relax any legacy NOT NULL column on public.appointments that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'student_id', 'doctor_id', 'appointment_date', 'start_time', 'end_time', 'reason', 'symptoms', 'status', 'student_note', 'doctor_note', 'rejection_reason', 'created_at', 'updated_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.appointments ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: appointments.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.appointments already existed with a different/older shape.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS student_note TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_note TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- NOTE: appointments.student_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.
-- NOTE: appointments.doctor_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.
UPDATE public.appointments SET appointment_date = CURRENT_DATE WHERE appointment_date IS NULL;
ALTER TABLE public.appointments ALTER COLUMN appointment_date SET NOT NULL;
-- NOTE: appointments.start_time is NOT NULL (TIME) with no default — left nullable for legacy-row safety.
-- NOTE: appointments.end_time is NOT NULL (TIME) with no default — left nullable for legacy-row safety.
UPDATE public.appointments SET reason = '' WHERE reason IS NULL;
ALTER TABLE public.appointments ALTER COLUMN reason SET NOT NULL;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_note TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Indexes for performance & slot conflict queries
CREATE INDEX IF NOT EXISTS idx_appointments_student_id ON public.appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_doc_date_time ON public.appointments(doctor_id, appointment_date, start_time, end_time);

-- Updated_at trigger for appointments
DROP TRIGGER IF EXISTS tr_appointments_updated_at ON public.appointments;
CREATE TRIGGER tr_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS on public.appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant appointments" ON public.appointments;
DROP POLICY IF EXISTS "Students can insert own appointment" ON public.appointments;
DROP POLICY IF EXISTS "Students can cancel own appointment" ON public.appointments;
DROP POLICY IF EXISTS "Admins have full access to appointments" ON public.appointments;

-- SELECT Policy:
-- Students can ONLY view their own appointments; Doctors can view appointments assigned to them; Admins view all.
CREATE POLICY "Users can view relevant appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.doctors d 
      WHERE d.id = doctor_id AND d.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Direct INSERTs and UPDATEs by students are DENIED by RLS.
-- All appointment bookings MUST go through create_appointment() RPC.
-- All cancellations MUST go through cancel_appointment() RPC.
-- Admins retain full direct access:
CREATE POLICY "Admins have full access to appointments"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 12. RPC Function: Atomic Double-Booking Protected Appointment Creation
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_doctor_id UUID,
  p_appointment_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_reason TEXT,
  p_symptoms TEXT DEFAULT NULL,
  p_student_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID;
  v_user_role TEXT;
  v_doc RECORD;
  v_new_app RECORD;
  v_reason_clean TEXT := TRIM(COALESCE(p_reason, ''));
BEGIN
  -- 1. Check authenticated user
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to book an appointment.';
  END IF;

  -- 2. Verify caller has student role (student_faculty)
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_student_id;

  IF v_user_role IS NULL OR v_user_role <> 'student_faculty' THEN
    RAISE EXCEPTION 'Access denied: Only registered students can book appointments.';
  END IF;

  -- 3. Validate reason field
  IF v_reason_clean = '' THEN
    RAISE EXCEPTION 'Appointment reason is required.';
  END IF;

  -- 4. Check date is not in the past
  IF p_appointment_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot book an appointment for a past date.';
  END IF;

  -- 5. Validate start and end times (must be 30 minutes, start < end, clinic hours 09:00 - 17:00)
  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Start time must be strictly earlier than end time.';
  END IF;

  IF (EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60)::INTEGER <> 30 THEN
    RAISE EXCEPTION 'Appointment duration must be exactly 30 minutes.';
  END IF;

  IF p_start_time < '09:00:00'::TIME OR p_end_time > '17:00:00'::TIME THEN
    RAISE EXCEPTION 'Appointment time must be within clinic hours (09:00 AM - 05:00 PM).';
  END IF;

  -- 6. Lock doctor row for update to guarantee atomic concurrency protection against double-booking
  SELECT * INTO v_doc
  FROM public.doctors
  WHERE id = p_doctor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected doctor record was not found.';
  END IF;

  IF NOT v_doc.is_available THEN
    RAISE EXCEPTION 'Dr. % is currently unavailable for new appointments.', v_doc.full_name;
  END IF;

  -- 7. Check for active overlapping appointments (status = pending or confirmed)
  -- Overlap condition: (existing_start < new_end) AND (existing_end > new_start)
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = p_doctor_id
    AND appointment_date = p_appointment_date
    AND status IN ('pending', 'confirmed')
    AND (start_time < p_end_time AND end_time > p_start_time)
  ) THEN
    RAISE EXCEPTION 'This time slot (% - %) is no longer available for Dr. %. Please select another slot.',
      to_char(p_start_time, 'HH12:MI AM'), to_char(p_end_time, 'HH12:MI AM'), v_doc.full_name;
  END IF;

  -- 8. Insert appointment atomically
  INSERT INTO public.appointments (
    student_id,
    doctor_id,
    appointment_date,
    start_time,
    end_time,
    reason,
    symptoms,
    status,
    student_note
  ) VALUES (
    v_student_id,
    p_doctor_id,
    p_appointment_date,
    p_start_time,
    p_end_time,
    v_reason_clean,
    NULLIF(TRIM(COALESCE(p_symptoms, '')), ''),
    'pending',
    NULLIF(TRIM(COALESCE(p_student_note, '')), '')
  )
  RETURNING * INTO v_new_app;

  -- 9. Create notification for doctor if doctor has linked user account
  IF v_doc.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      category,
      priority
    ) VALUES (
      v_doc.user_id,
      'New Appointment Request',
      'New appointment booking request for ' || p_appointment_date::text || ' at ' || to_char(p_start_time, 'HH12:MI AM') || '.',
      'appointment',
      'normal'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Appointment successfully booked!',
    'appointment', jsonb_build_object(
      'id', v_new_app.id,
      'student_id', v_new_app.student_id,
      'doctor_id', v_new_app.doctor_id,
      'appointment_date', v_new_app.appointment_date,
      'start_time', v_new_app.start_time,
      'end_time', v_new_app.end_time,
      'reason', v_new_app.reason,
      'symptoms', v_new_app.symptoms,
      'status', v_new_app.status,
      'created_at', v_new_app.created_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment(UUID, DATE, TIME, TIME, TEXT, TEXT, TEXT) TO authenticated;

-- 13. RPC Function: Safe Appointment Cancellation
CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app RECORD;
  v_user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = auth.uid();

  SELECT * INTO v_app
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found.';
  END IF;

  -- Verify caller owns the appointment or is admin
  IF v_app.student_id <> auth.uid() AND NOT (v_user_role IN ('super_admin', 'emergency_admin') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: You can only cancel your own appointments.';
  END IF;

  IF v_app.status IN ('completed', 'cancelled', 'rejected') THEN
    RAISE EXCEPTION 'Appointment is already % and cannot be cancelled.', v_app.status;
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_appointment_id;

  -- Notify doctor if doctor user_id exists and caller is student
  BEGIN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      category,
      priority
    )
    SELECT
      d.user_id,
      'Appointment Cancelled',
      'Appointment scheduled for ' || v_app.appointment_date::text || ' at ' || to_char(v_app.start_time, 'HH12:MI AM') || ' was cancelled.',
      'appointment',
      'normal'
    FROM public.doctors d
    WHERE d.id = v_app.doctor_id AND d.user_id IS NOT NULL AND d.user_id <> auth.uid();
  EXCEPTION WHEN OTHERS THEN
    -- Ignore notification failures so appointment cancellation succeeds
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Appointment cancelled successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment(UUID) TO authenticated;

-- 14. RPC Function: Get Booked Time Slots for a Doctor on a Date
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

GRANT EXECUTE ON FUNCTION public.get_booked_slots(UUID, DATE) TO authenticated;

-- 15. RPC Function: Confirm Appointment (Doctor only)
CREATE OR REPLACE FUNCTION public.confirm_appointment(
  p_appointment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app RECORD;
  v_doc RECORD;
  v_user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = auth.uid();

  SELECT * INTO v_app
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment record not found.';
  END IF;

  SELECT * INTO v_doc
  FROM public.doctors
  WHERE id = v_app.doctor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated doctor record not found.';
  END IF;

  IF (v_doc.user_id IS NULL OR v_doc.user_id <> auth.uid()) AND NOT (v_user_role IN ('super_admin', 'emergency_admin') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: You can only confirm appointments assigned to your doctor profile.';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'This appointment is no longer pending (current status: %).', v_app.status;
  END IF;

  UPDATE public.appointments
  SET status = 'confirmed', updated_at = now()
  WHERE id = p_appointment_id AND status = 'pending';

  -- Notify student that appointment was confirmed
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority
  ) VALUES (
    v_app.student_id,
    'Appointment Confirmed',
    'Your appointment with Dr. ' || COALESCE(v_doc.full_name, 'your doctor') || ' on ' || v_app.appointment_date::text || ' at ' || to_char(v_app.start_time, 'HH12:MI AM') || ' has been confirmed.',
    'appointment',
    'normal'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Appointment confirmed successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_appointment(UUID) TO authenticated;

-- 16. RPC Function: Reject Appointment (Doctor only)
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
  v_app RECORD;
  v_doc RECORD;
  v_user_role TEXT;
  v_reason TEXT := TRIM(COALESCE(p_rejection_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = auth.uid();

  SELECT * INTO v_app
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment record not found.';
  END IF;

  SELECT * INTO v_doc
  FROM public.doctors
  WHERE id = v_app.doctor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated doctor record not found.';
  END IF;

  IF (v_doc.user_id IS NULL OR v_doc.user_id <> auth.uid()) AND NOT (v_user_role IN ('super_admin', 'emergency_admin') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: You can only reject appointments assigned to your doctor profile.';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'This appointment is no longer pending (current status: %).', v_app.status;
  END IF;

  UPDATE public.appointments
  SET 
    status = 'rejected',
    rejection_reason = CASE WHEN v_reason <> '' THEN v_reason ELSE NULL END,
    updated_at = now()
  WHERE id = p_appointment_id AND status = 'pending';

  -- Notify student that appointment was rejected with optional reason
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority
  ) VALUES (
    v_app.student_id,
    'Appointment Request Declined',
    'Your appointment request with Dr. ' || COALESCE(v_doc.full_name, 'your doctor') || ' on ' || v_app.appointment_date::text || ' was declined.' || CASE WHEN v_reason <> '' THEN ' Reason: ' || v_reason ELSE '' END,
    'appointment',
    'normal'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Appointment rejected.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_appointment(UUID, TEXT) TO authenticated;

-- 17. RPC Function: Complete Appointment (Doctor only)
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
  v_app RECORD;
  v_doc RECORD;
  v_user_role TEXT;
  v_note TEXT := TRIM(COALESCE(p_doctor_note, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = auth.uid();

  SELECT * INTO v_app
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment record not found.';
  END IF;

  SELECT * INTO v_doc
  FROM public.doctors
  WHERE id = v_app.doctor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated doctor record not found.';
  END IF;

  IF (v_doc.user_id IS NULL OR v_doc.user_id <> auth.uid()) AND NOT (v_user_role IN ('super_admin', 'emergency_admin') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied: You can only complete appointments assigned to your doctor profile.';
  END IF;

  IF v_app.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed appointments can be marked as completed (current status: %).', v_app.status;
  END IF;

  UPDATE public.appointments
  SET 
    status = 'completed',
    doctor_note = CASE WHEN v_note <> '' THEN v_note ELSE NULL END,
    updated_at = now()
  WHERE id = p_appointment_id AND status = 'confirmed';

  -- Notify student that appointment was completed
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority
  ) VALUES (
    v_app.student_id,
    'Appointment Consultation Completed',
    'Your medical consultation with Dr. ' || COALESCE(v_doc.full_name, 'your doctor') || ' on ' || v_app.appointment_date::text || ' has been completed.',
    'appointment',
    'normal'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Appointment completed successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 18. STEP 6: SOS Emergency System & Admin Monitoring
-- ============================================================================

-- Table: public.sos_alerts
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latitude NUMERIC,
  longitude NUMERIC,
  location_accuracy NUMERIC,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'cancelled')),
  emergency_type TEXT DEFAULT 'medical',
  message TEXT,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id)
);

-- Safety net: relax any legacy NOT NULL column on public.sos_alerts that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'student_id', 'latitude', 'longitude', 'location_accuracy', 'status', 'emergency_type', 'message', 'resolution_note', 'created_at', 'acknowledged_at', 'acknowledged_by', 'resolved_at', 'resolved_by'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_alerts'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.sos_alerts ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: sos_alerts.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.sos_alerts already existed with a different/older shape.
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS emergency_type TEXT DEFAULT 'medical';
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES public.users(id);
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.users(id);
-- NOTE: sos_alerts.student_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.

-- Indexes for performance & Realtime admin monitoring queries
CREATE INDEX IF NOT EXISTS idx_sos_alerts_student_id ON public.sos_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON public.sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_created_at ON public.sos_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status_created ON public.sos_alerts(status, created_at DESC);

-- Enable RLS
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view relevant sos alerts" ON public.sos_alerts;
CREATE POLICY "Users can view relevant sos alerts"
  ON public.sos_alerts
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins have full access to sos alerts" ON public.sos_alerts;
CREATE POLICY "Admins have full access to sos alerts"
  ON public.sos_alerts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Enable Supabase Realtime for sos_alerts
DO $$ 
BEGIN 
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
EXCEPTION WHEN OTHERS THEN 
  NULL; 
END $$;

-- RPC Function: Create SOS Alert (Student only)
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
  v_student_id UUID := auth.uid();
  v_user_role TEXT;
  v_existing_alert RECORD;
  v_new_alert RECORD;
  v_msg_clean TEXT := TRIM(COALESCE(p_message, ''));
  v_type_clean TEXT := COALESCE(TRIM(p_emergency_type), 'medical');
BEGIN
  -- 1. Verify caller is authenticated
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to trigger emergency SOS alert.';
  END IF;

  -- 2. Verify caller role is student_faculty
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_student_id;

  IF v_user_role IS NULL OR v_user_role <> 'student_faculty' THEN
    RAISE EXCEPTION 'Access denied: Only registered campus students can trigger SOS alerts.';
  END IF;

  -- 3. Validate coordinates if provided
  IF p_latitude IS NOT NULL AND (p_latitude < -90 OR p_latitude > 90) THEN
    RAISE EXCEPTION 'Invalid latitude value. Must be between -90 and 90.';
  END IF;

  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN
    RAISE EXCEPTION 'Invalid longitude value. Must be between -180 and 180.';
  END IF;

  IF p_accuracy IS NOT NULL AND p_accuracy < 0 THEN
    RAISE EXCEPTION 'Invalid location accuracy value.';
  END IF;

  -- 4. Spam / Duplicate Protection: Check if student already has an active SOS alert
  SELECT * INTO v_existing_alert
  FROM public.sos_alerts
  WHERE student_id = v_student_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'alert', to_jsonb(v_existing_alert),
      'message', 'An active emergency SOS alert is already in progress for your account.'
    );
  END IF;

  -- 5. Insert new active SOS alert
  INSERT INTO public.sos_alerts (
    student_id,
    latitude,
    longitude,
    location_accuracy,
    status,
    emergency_type,
    message
  ) VALUES (
    v_student_id,
    p_latitude,
    p_longitude,
    p_accuracy,
    'active',
    v_type_clean,
    CASE WHEN v_msg_clean <> '' THEN v_msg_clean ELSE NULL END
  )
  RETURNING * INTO v_new_alert;

  -- 6. Insert urgent notification to all Emergency Admins & Super Admins
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority
  )
  SELECT 
    u.id,
    'URGENT: Active SOS Emergency Alert',
    'Emergency SOS triggered (' || UPPER(v_type_clean) || '). ' || COALESCE(v_msg_clean, 'Distress signal received from campus grounds.'),
    'emergency',
    'urgent'
  FROM public.users u
  WHERE u.role IN ('emergency_admin', 'super_admin');

  RETURN jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'alert', to_jsonb(v_new_alert),
    'message', 'Emergency SOS alert dispatched successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sos_alert(NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- RPC Function: Acknowledge SOS Alert (Emergency Admin / Super Admin only)
CREATE OR REPLACE FUNCTION public.acknowledge_sos_alert(
  p_alert_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alert RECORD;
  v_user_role TEXT;
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_admin_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Only authorized emergency administration can acknowledge SOS alerts.';
  END IF;

  SELECT * INTO v_alert
  FROM public.sos_alerts
  WHERE id = p_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency SOS alert record not found.';
  END IF;

  IF v_alert.status <> 'active' THEN
    RAISE EXCEPTION 'This emergency alert is no longer active (current status: %).', v_alert.status;
  END IF;

  UPDATE public.sos_alerts
  SET
    status = 'acknowledged',
    acknowledged_at = now(),
    acknowledged_by = v_admin_id
  WHERE id = p_alert_id AND status = 'active';

  -- Notify student that SOS alert was acknowledged by emergency response team
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority
  ) VALUES (
    v_alert.student_id,
    'SOS Emergency Acknowledged',
    'Campus Security & Emergency Responders have acknowledged your distress alert and are in route/responding.',
    'emergency',
    'urgent'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Emergency alert acknowledged.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_sos_alert(UUID) TO authenticated;

-- RPC Function: Resolve SOS Alert (Emergency Admin / Super Admin only)
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
  v_alert RECORD;
  v_user_role TEXT;
  v_admin_id UUID := auth.uid();
  v_note_clean TEXT := TRIM(COALESCE(p_resolution_note, ''));
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_admin_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Only authorized emergency administration can resolve SOS alerts.';
  END IF;

  SELECT * INTO v_alert
  FROM public.sos_alerts
  WHERE id = p_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency SOS alert record not found.';
  END IF;

  IF v_alert.status NOT IN ('active', 'acknowledged') THEN
    RAISE EXCEPTION 'Cannot resolve an alert with status "%".', v_alert.status;
  END IF;

  UPDATE public.sos_alerts
  SET
    status = 'resolved',
    resolution_note = CASE WHEN v_note_clean <> '' THEN v_note_clean ELSE NULL END,
    resolved_at = now(),
    resolved_by = v_admin_id
  WHERE id = p_alert_id AND status IN ('active', 'acknowledged');

  -- Notify student that SOS emergency has been resolved
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    category,
    priority
  ) VALUES (
    v_alert.student_id,
    'SOS Emergency Resolved',
    'Your emergency SOS alert has been officially marked as resolved by campus emergency administration.' || CASE WHEN v_note_clean <> '' THEN ' Note: ' || v_note_clean ELSE '' END,
    'emergency',
    'normal'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Emergency alert resolved.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_sos_alert(UUID, TEXT) TO authenticated;

-- RPC Function: Cancel SOS Alert (Student owner only)
CREATE OR REPLACE FUNCTION public.cancel_sos_alert(
  p_alert_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alert RECORD;
  v_student_id UUID := auth.uid();
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_alert
  FROM public.sos_alerts
  WHERE id = p_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency SOS alert record not found.';
  END IF;

  IF v_alert.student_id <> v_student_id THEN
    RAISE EXCEPTION 'Access denied: You can only cancel your own SOS alerts.';
  END IF;

  IF v_alert.status <> 'active' THEN
    RAISE EXCEPTION 'Only active alerts can be cancelled by the student (current status: %).', v_alert.status;
  END IF;

  UPDATE public.sos_alerts
  SET status = 'cancelled'
  WHERE id = p_alert_id AND status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Emergency alert cancelled.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sos_alert(UUID) TO authenticated;

-- ============================================================================
-- 19. STEP 7: Incident Reporting + Secure Photo Upload
-- ============================================================================

-- Table: public.incident_reports
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Medical', 'Safety', 'Campus Facility', 'Harassment/Concern', 'Other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  incident_time TIME,
  location TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'resolved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id)
);

-- Safety net: relax any legacy NOT NULL column on public.incident_reports that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'reporter_id', 'category', 'title', 'description', 'incident_date', 'incident_time', 'location', 'evidence_urls', 'status', 'admin_note', 'created_at', 'updated_at', 'reviewed_at', 'reviewed_by'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incident_reports'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.incident_reports ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: incident_reports.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.incident_reports already existed with a different/older shape.
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_time TIME;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id);
-- NOTE: incident_reports.reporter_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.
UPDATE public.incident_reports SET category = '' WHERE category IS NULL;
ALTER TABLE public.incident_reports ALTER COLUMN category SET NOT NULL;
UPDATE public.incident_reports SET title = '' WHERE title IS NULL;
ALTER TABLE public.incident_reports ALTER COLUMN title SET NOT NULL;
UPDATE public.incident_reports SET description = '' WHERE description IS NULL;
ALTER TABLE public.incident_reports ALTER COLUMN description SET NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incident_reports_reporter_id ON public.incident_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_category ON public.incident_reports(category);
CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at ON public.incident_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status_created ON public.incident_reports(status, created_at DESC);

-- Enable RLS
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for incident_reports
DROP POLICY IF EXISTS "Users can view relevant incident reports" ON public.incident_reports;
CREATE POLICY "Users can view relevant incident reports"
  ON public.incident_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins have full access to incident reports" ON public.incident_reports;
CREATE POLICY "Admins have full access to incident reports"
  ON public.incident_reports
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Enable Realtime Publications safely
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
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL; 
END $$;

-- Storage Bucket Setup for Incident Evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-evidence', 'incident-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for incident-evidence
DROP POLICY IF EXISTS "Authenticated users can upload own incident evidence" ON storage.objects;
CREATE POLICY "Authenticated users can upload own incident evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can view own or admin view incident evidence" ON storage.objects;
CREATE POLICY "Users can view own or admin view incident evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-evidence' AND 
    ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "Users can delete own incident evidence" ON storage.objects;
CREATE POLICY "Users can delete own incident evidence"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'incident-evidence' AND 
    ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- RPC Function: Create Incident Report (Student)
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
  v_user_role TEXT;
  v_title_clean TEXT := TRIM(COALESCE(p_title, ''));
  v_desc_clean TEXT := TRIM(COALESCE(p_description, ''));
  v_cat_clean TEXT := TRIM(COALESCE(p_category, ''));
  v_new_report RECORD;
BEGIN
  -- 1. Authentication check
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit an incident report.';
  END IF;

  -- 2. Verify student role
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_student_id;

  IF v_user_role IS NULL OR v_user_role <> 'student_faculty' THEN
    RAISE EXCEPTION 'Access denied: Only registered campus students can submit incident reports.';
  END IF;

  -- 3. Validate inputs
  IF v_title_clean = '' THEN
    RAISE EXCEPTION 'Incident title is required.';
  END IF;

  IF v_desc_clean = '' THEN
    RAISE EXCEPTION 'Incident description is required.';
  END IF;

  IF v_cat_clean NOT IN ('Medical', 'Safety', 'Campus Facility', 'Harassment/Concern', 'Other') THEN
    RAISE EXCEPTION 'Invalid incident category. Must be Medical, Safety, Campus Facility, Harassment/Concern, or Other.';
  END IF;

  IF p_incident_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Incident date cannot be in the future.';
  END IF;

  -- 4. Create record
  INSERT INTO public.incident_reports (
    reporter_id,
    category,
    title,
    description,
    incident_date,
    incident_time,
    location,
    evidence_urls,
    status
  ) VALUES (
    v_student_id,
    v_cat_clean,
    v_title_clean,
    v_desc_clean,
    COALESCE(p_incident_date, CURRENT_DATE),
    p_incident_time,
    TRIM(COALESCE(p_location, '')),
    COALESCE(p_evidence_urls, '{}'),
    'submitted'
  )
  RETURNING * INTO v_new_report;

  RETURN jsonb_build_object(
    'success', true,
    'report', to_jsonb(v_new_report),
    'message', 'Incident report submitted successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_incident_report(TEXT, TEXT, TEXT, TEXT, DATE, TIME, TEXT[]) TO authenticated;

-- RPC Function: Move Incident Report to Under Review (Admin)
CREATE OR REPLACE FUNCTION public.review_incident_report(
  p_report_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
  v_user_role TEXT;
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_admin_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Only authorized administration can review incident reports.';
  END IF;

  SELECT * INTO v_report
  FROM public.incident_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident report not found.';
  END IF;

  IF v_report.status <> 'submitted' THEN
    RAISE EXCEPTION 'Report is not in "submitted" state (current status: %).', v_report.status;
  END IF;

  UPDATE public.incident_reports
  SET
    status = 'under_review',
    reviewed_at = now(),
    reviewed_by = v_admin_id,
    updated_at = now()
  WHERE id = p_report_id AND status = 'submitted';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Incident report is now under review.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_incident_report(UUID) TO authenticated;

-- RPC Function: Resolve Incident Report (Admin)
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
  v_report RECORD;
  v_user_role TEXT;
  v_admin_id UUID := auth.uid();
  v_note_clean TEXT := TRIM(COALESCE(p_admin_note, ''));
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_admin_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Only authorized administration can resolve incident reports.';
  END IF;

  SELECT * INTO v_report
  FROM public.incident_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident report not found.';
  END IF;

  IF v_report.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Cannot resolve report with status "%".', v_report.status;
  END IF;

  UPDATE public.incident_reports
  SET
    status = 'resolved',
    admin_note = CASE WHEN v_note_clean <> '' THEN v_note_clean ELSE NULL END,
    reviewed_at = COALESCE(reviewed_at, now()),
    reviewed_by = COALESCE(reviewed_by, v_admin_id),
    updated_at = now()
  WHERE id = p_report_id AND status IN ('submitted', 'under_review');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Incident report resolved.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_incident_report(UUID, TEXT) TO authenticated;

-- RPC Function: Reject Incident Report (Admin)
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
  v_report RECORD;
  v_user_role TEXT;
  v_admin_id UUID := auth.uid();
  v_note_clean TEXT := TRIM(COALESCE(p_admin_note, ''));
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_admin_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Only authorized administration can reject incident reports.';
  END IF;

  SELECT * INTO v_report
  FROM public.incident_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident report not found.';
  END IF;

  IF v_report.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Cannot reject report with status "%".', v_report.status;
  END IF;

  UPDATE public.incident_reports
  SET
    status = 'rejected',
    admin_note = CASE WHEN v_note_clean <> '' THEN v_note_clean ELSE NULL END,
    reviewed_at = COALESCE(reviewed_at, now()),
    reviewed_by = COALESCE(reviewed_by, v_admin_id),
    updated_at = now()
  WHERE id = p_report_id AND status IN ('submitted', 'under_review');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Incident report rejected.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_incident_report(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 20. STEP 8: Secure Health Records Module
-- ============================================================================

-- Table: public.health_records
CREATE TABLE IF NOT EXISTS public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  diagnosis TEXT NOT NULL,
  clinical_summary TEXT,
  prescription TEXT,
  treatment_plan TEXT,
  follow_up_instructions TEXT,
  doctor_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by UUID REFERENCES public.users(id),
  CONSTRAINT unique_appointment_health_record UNIQUE (appointment_id)
);

-- Safety net: relax any legacy NOT NULL column on public.health_records that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'student_id', 'doctor_id', 'appointment_id', 'diagnosis', 'clinical_summary', 'prescription', 'treatment_plan', 'follow_up_instructions', 'doctor_note', 'created_at', 'updated_at', 'last_updated_by'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'health_records'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.health_records ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: health_records.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.health_records already existed with a different/older shape.
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS clinical_summary TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS prescription TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS treatment_plan TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS follow_up_instructions TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS doctor_note TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES public.users(id);
-- NOTE: health_records.student_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.
-- NOTE: health_records.doctor_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.
UPDATE public.health_records SET diagnosis = '' WHERE diagnosis IS NULL;
ALTER TABLE public.health_records ALTER COLUMN diagnosis SET NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_records_student_id ON public.health_records(student_id);
CREATE INDEX IF NOT EXISTS idx_health_records_doctor_id ON public.health_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_health_records_appointment_id ON public.health_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_health_records_created_at ON public.health_records(created_at DESC);

-- Updated_at trigger for health_records
DROP TRIGGER IF EXISTS tr_health_records_updated_at ON public.health_records;
CREATE TRIGGER tr_health_records_updated_at
  BEFORE UPDATE ON public.health_records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Students can view own health records" ON public.health_records;
CREATE POLICY "Students can view own health records"
  ON public.health_records
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Doctors can view patient health records" ON public.health_records;
CREATE POLICY "Doctors can view patient health records"
  ON public.health_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = health_records.doctor_id
      AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view health records" ON public.health_records;
CREATE POLICY "Admins can view health records"
  ON public.health_records
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins have full access to health records" ON public.health_records;
CREATE POLICY "Admins have full access to health records"
  ON public.health_records
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RPC Function: create_health_record (Doctor)
CREATE OR REPLACE FUNCTION public.create_health_record(
  p_student_id UUID,
  p_diagnosis TEXT,
  p_appointment_id UUID DEFAULT NULL,
  p_clinical_summary TEXT DEFAULT NULL,
  p_prescription TEXT DEFAULT NULL,
  p_treatment_plan TEXT DEFAULT NULL,
  p_follow_up_instructions TEXT DEFAULT NULL,
  p_doctor_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_doctor_id UUID;
  v_user_role TEXT;
  v_diag_clean TEXT := TRIM(COALESCE(p_diagnosis, ''));
  v_app RECORD;
  v_new_record RECORD;
BEGIN
  -- 1. Authentication check
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a health record.';
  END IF;

  -- 2. Verify caller role is doctor
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_caller_id;

  IF v_user_role IS NULL OR v_user_role <> 'doctor' THEN
    RAISE EXCEPTION 'Access denied: Only verified doctors can create health records.';
  END IF;

  -- 3. Resolve caller's doctor profile
  SELECT id INTO v_doctor_id
  FROM public.doctors
  WHERE user_id = v_caller_id;

  IF v_doctor_id IS NULL THEN
    SELECT d.id INTO v_doctor_id
    FROM public.doctors d
    JOIN public.users u ON LOWER(u.email) = LOWER(d.email)
    WHERE u.id = v_caller_id;
  END IF;

  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Doctor profile not found for authenticated user.';
  END IF;

  -- 4. Validate clinical inputs
  IF v_diag_clean = '' THEN
    RAISE EXCEPTION 'Clinical diagnosis is required.';
  END IF;

  -- 5. If appointment_id is supplied, verify legitimate relationship
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_app
    FROM public.appointments
    WHERE id = p_appointment_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Appointment not found.';
    END IF;

    -- Verify appointment belongs to this doctor
    IF v_app.doctor_id <> v_doctor_id THEN
      RAISE EXCEPTION 'Access denied: Appointment belongs to another doctor.';
    END IF;

    -- Verify appointment belongs to target student
    IF v_app.student_id <> p_student_id THEN
      RAISE EXCEPTION 'Access denied: Student ID mismatch with selected appointment.';
    END IF;

    -- Check if record already exists for this appointment
    IF EXISTS (
      SELECT 1 FROM public.health_records
      WHERE appointment_id = p_appointment_id
    ) THEN
      RAISE EXCEPTION 'A health record has already been created for this appointment.';
    END IF;
  ELSE
    -- If no appointment_id supplied, verify doctor has at least one appointment with student
    IF NOT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE doctor_id = v_doctor_id AND student_id = p_student_id
    ) AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Access denied: You can only create health records for students with whom you have a medical consultation relationship.';
    END IF;
  END IF;

  -- 6. Insert health record using trusted server-derived v_doctor_id
  INSERT INTO public.health_records (
    student_id,
    doctor_id,
    appointment_id,
    diagnosis,
    clinical_summary,
    prescription,
    treatment_plan,
    follow_up_instructions,
    doctor_note,
    last_updated_by
  ) VALUES (
    p_student_id,
    v_doctor_id,
    p_appointment_id,
    v_diag_clean,
    NULLIF(TRIM(COALESCE(p_clinical_summary, '')), ''),
    NULLIF(TRIM(COALESCE(p_prescription, '')), ''),
    NULLIF(TRIM(COALESCE(p_treatment_plan, '')), ''),
    NULLIF(TRIM(COALESCE(p_follow_up_instructions, '')), ''),
    NULLIF(TRIM(COALESCE(p_doctor_note, '')), ''),
    v_caller_id
  )
  RETURNING * INTO v_new_record;

  -- 7. If appointment exists and is confirmed, transition status to 'completed'
  IF p_appointment_id IS NOT NULL AND v_app.status IN ('confirmed', 'pending') THEN
    UPDATE public.appointments
    SET status = 'completed', updated_at = now()
    WHERE id = p_appointment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Health record created successfully.',
    'record', to_jsonb(v_new_record)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_health_record(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- RPC Function: update_health_record (Doctor)
CREATE OR REPLACE FUNCTION public.update_health_record(
  p_record_id UUID,
  p_diagnosis TEXT,
  p_clinical_summary TEXT DEFAULT NULL,
  p_prescription TEXT DEFAULT NULL,
  p_treatment_plan TEXT DEFAULT NULL,
  p_follow_up_instructions TEXT DEFAULT NULL,
  p_doctor_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_doctor_id UUID;
  v_user_role TEXT;
  v_diag_clean TEXT := TRIM(COALESCE(p_diagnosis, ''));
  v_existing RECORD;
BEGIN
  -- 1. Authentication check
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Verify caller role
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_caller_id;

  IF v_user_role IS NULL OR v_user_role <> 'doctor' THEN
    RAISE EXCEPTION 'Access denied: Only verified doctors can update health records.';
  END IF;

  -- 3. Resolve caller doctor profile
  SELECT id INTO v_doctor_id
  FROM public.doctors
  WHERE user_id = v_caller_id;

  IF v_doctor_id IS NULL THEN
    SELECT d.id INTO v_doctor_id
    FROM public.doctors d
    JOIN public.users u ON LOWER(u.email) = LOWER(d.email)
    WHERE u.id = v_caller_id;
  END IF;

  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Doctor profile not found.';
  END IF;

  -- 4. Validate diagnosis input
  IF v_diag_clean = '' THEN
    RAISE EXCEPTION 'Clinical diagnosis cannot be empty.';
  END IF;

  -- 5. Lock existing record
  SELECT * INTO v_existing
  FROM public.health_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Health record not found.';
  END IF;

  -- 6. Verify record ownership by doctor
  IF v_existing.doctor_id <> v_doctor_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: You can only update health records created by you.';
  END IF;

  -- 7. Update clinical fields ONLY (student_id, doctor_id, appointment_id remain untouched)
  UPDATE public.health_records
  SET
    diagnosis = v_diag_clean,
    clinical_summary = NULLIF(TRIM(COALESCE(p_clinical_summary, '')), ''),
    prescription = NULLIF(TRIM(COALESCE(p_prescription, '')), ''),
    treatment_plan = NULLIF(TRIM(COALESCE(p_treatment_plan, '')), ''),
    follow_up_instructions = NULLIF(TRIM(COALESCE(p_follow_up_instructions, '')), ''),
    doctor_note = NULLIF(TRIM(COALESCE(p_doctor_note, '')), ''),
    updated_at = now(),
    last_updated_by = v_caller_id
  WHERE id = p_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Health record updated successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_health_record(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 21. STEP 9: CampusCare Broadcast & Notification System
-- ============================================================================

-- Table: public.broadcasts
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('general', 'health', 'emergency', 'appointment', 'safety', 'campus')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'student_faculty', 'doctor', 'emergency_admin', 'super_admin')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safety net: relax any legacy NOT NULL column on public.broadcasts that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'title', 'message', 'category', 'priority', 'target_role', 'created_by', 'created_at', 'updated_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'broadcasts'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.broadcasts ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: broadcasts.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.broadcasts already existed with a different/older shape.
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'all';
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE public.broadcasts SET title = '' WHERE title IS NULL;
ALTER TABLE public.broadcasts ALTER COLUMN title SET NOT NULL;
UPDATE public.broadcasts SET message = '' WHERE message IS NULL;
ALTER TABLE public.broadcasts ALTER COLUMN message SET NOT NULL;
UPDATE public.broadcasts SET category = '' WHERE category IS NULL;
ALTER TABLE public.broadcasts ALTER COLUMN category SET NOT NULL;

-- Table: public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Safety net: relax any legacy NOT NULL column on public.notifications that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'user_id', 'broadcast_id', 'title', 'message', 'category', 'priority', 'is_read', 'created_at', 'read_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.notifications ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: notifications.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.notifications already existed with a different/older shape.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
-- NOTE: notifications.user_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.
UPDATE public.notifications SET title = '' WHERE title IS NULL;
ALTER TABLE public.notifications ALTER COLUMN title SET NOT NULL;
UPDATE public.notifications SET message = '' WHERE message IS NULL;
ALTER TABLE public.notifications ALTER COLUMN message SET NOT NULL;
UPDATE public.notifications SET category = '' WHERE category IS NULL;
ALTER TABLE public.notifications ALTER COLUMN category SET NOT NULL;

-- Indexes for performance & query speed
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON public.broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_target_role ON public.broadcasts(target_role);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS tr_broadcasts_updated_at ON public.broadcasts;
CREATE TRIGGER tr_broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcasts
DROP POLICY IF EXISTS "Admins can view and manage broadcasts" ON public.broadcasts;
CREATE POLICY "Admins can view and manage broadcasts"
  ON public.broadcasts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RPC Function: create_broadcast (Emergency Admin & Super Admin)
CREATE OR REPLACE FUNCTION public.create_broadcast(
  p_title TEXT,
  p_message TEXT,
  p_category TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_target_role TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_title_clean TEXT := TRIM(COALESCE(p_title, ''));
  v_msg_clean TEXT := TRIM(COALESCE(p_message, ''));
  v_cat_clean TEXT := TRIM(COALESCE(p_category, 'general'));
  v_prio_clean TEXT := TRIM(COALESCE(p_priority, 'normal'));
  v_target_clean TEXT := TRIM(COALESCE(p_target_role, 'all'));
  v_new_broadcast RECORD;
  v_recipient_count INT := 0;
BEGIN
  -- 1. Authentication check
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Verify admin privilege
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only emergency admins and super admins can issue broadcasts.';
  END IF;

  -- 3. Input Validation
  IF v_title_clean = '' THEN
    RAISE EXCEPTION 'Broadcast title is required.';
  END IF;

  IF v_msg_clean = '' THEN
    RAISE EXCEPTION 'Broadcast message is required.';
  END IF;

  IF v_cat_clean NOT IN ('general', 'health', 'emergency', 'appointment', 'safety', 'campus') THEN
    v_cat_clean := 'general';
  END IF;

  IF v_prio_clean NOT IN ('low', 'normal', 'high', 'urgent') THEN
    v_prio_clean := 'normal';
  END IF;

  IF v_target_clean NOT IN ('all', 'student_faculty', 'doctor', 'emergency_admin', 'super_admin') THEN
    v_target_clean := 'all';
  END IF;

  -- 4. Insert broadcast record
  INSERT INTO public.broadcasts (
    title,
    message,
    category,
    priority,
    target_role,
    created_by
  ) VALUES (
    v_title_clean,
    v_msg_clean,
    v_cat_clean,
    v_prio_clean,
    v_target_clean,
    v_caller_id
  )
  RETURNING * INTO v_new_broadcast;

  -- 5. Generate notifications for target users
  INSERT INTO public.notifications (
    user_id,
    broadcast_id,
    title,
    message,
    category,
    priority,
    is_read
  )
  SELECT 
    u.id,
    v_new_broadcast.id,
    v_title_clean,
    v_msg_clean,
    v_cat_clean,
    v_prio_clean,
    false
  FROM public.users u
  WHERE 
    CASE 
      WHEN v_target_clean = 'all' THEN true
      ELSE u.role = v_target_clean
    END;

  GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Broadcast created and notifications dispatched successfully.',
    'recipient_count', v_recipient_count,
    'broadcast', to_jsonb(v_new_broadcast)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_broadcast(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- RPC Function: mark_notification_read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  UPDATE public.notifications
  SET 
    is_read = true,
    read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND user_id = v_caller_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Notification marked as read.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

-- RPC Function: mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_updated_count INT := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  UPDATE public.notifications
  SET 
    is_read = true,
    read_at = COALESCE(read_at, now())
  WHERE user_id = v_caller_id
    AND is_read = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'All notifications marked as read.',
    'updated_count', v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ============================================================================
-- 22. STEP 10: Super Admin Dashboard, User Management & Audit Logging System
-- ============================================================================

-- Add account status column to public.users if not present, and make sure the
-- CHECK constraint allows 'disabled' even if the column/constraint already existed
-- from the original table definition (ADD COLUMN IF NOT EXISTS is a no-op on an
-- existing column, so it silently would NOT widen an existing constraint).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'users'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'disabled'));
END $$;

-- Table: public.admin_audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safety net: relax any legacy NOT NULL column on public.admin_audit_logs that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'actor_id', 'action', 'target_user_id', 'metadata', 'created_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_audit_logs'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.admin_audit_logs ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: admin_audit_logs.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.admin_audit_logs already existed with a different/older shape.
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
UPDATE public.admin_audit_logs SET action = '' WHERE action IS NULL;
ALTER TABLE public.admin_audit_logs ALTER COLUMN action SET NOT NULL;

-- Indexes for audit performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);

-- Enable RLS on audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to verify if caller is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- RLS policy: Authorized admins (super_admin, emergency_admin) can SELECT audit logs
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Authorized admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Authorized admins can view audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Secure Audit Helper Function
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

GRANT EXECUTE ON FUNCTION public.log_admin_audit(TEXT, UUID, JSONB) TO authenticated;

-- RPC Function: update_user_role
CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target RECORD;
  v_role_clean TEXT := LOWER(TRIM(COALESCE(p_new_role, '')));
BEGIN
  -- 1. Authentication check
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Verify caller is super_admin
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: Only Super Admins can modify user roles.';
  END IF;

  -- 3. Validate target role
  IF v_role_clean NOT IN ('student_faculty', 'doctor', 'emergency_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role specified: %', p_new_role;
  END IF;

  -- 4. Verify target user existence with row locking
  SELECT * INTO v_target FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;

  -- 5. Prevent self-demotion
  IF p_user_id = v_caller_id AND v_role_clean <> 'super_admin' THEN
    RAISE EXCEPTION 'Self-demotion is not allowed. Super Admins cannot revoke their own Super Admin status.';
  END IF;

  -- 6. Check if role is unchanged
  IF v_target.role = v_role_clean THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'User already possesses this role.',
      'user_id', p_user_id,
      'role', v_role_clean
    );
  END IF;

  -- 7. Update target user role
  UPDATE public.users
  SET role = v_role_clean, updated_at = now()
  WHERE id = p_user_id;

  -- 8. If new role is doctor, ensure doctor record exists
  IF v_role_clean = 'doctor' THEN
    IF NOT EXISTS (SELECT 1 FROM public.doctors WHERE user_id = p_user_id OR LOWER(email) = LOWER(v_target.email)) THEN
      INSERT INTO public.doctors (
        user_id,
        doctor_id,
        full_name,
        email,
        department,
        specialization,
        phone,
        designation,
        is_available
      ) VALUES (
        p_user_id,
        COALESCE(v_target.university_id, 'DOC-' || SUBSTRING(p_user_id::text FROM 1 FOR 6)),
        v_target.name,
        LOWER(v_target.email),
        COALESCE(v_target.department, 'Medical Center'),
        'General Medicine',
        v_target.phone,
        'Consultant Physician',
        true
      )
      ON CONFLICT (email) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        updated_at = now();
    ELSE
      UPDATE public.doctors
      SET user_id = p_user_id, updated_at = now()
      WHERE user_id IS NULL AND LOWER(email) = LOWER(v_target.email);
    END IF;
  END IF;

  -- 9. Insert audit record
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    target_user_id,
    metadata
  ) VALUES (
    v_caller_id,
    'role_changed',
    p_user_id,
    jsonb_build_object(
      'target_email', v_target.email,
      'old_role', v_target.role,
      'new_role', v_role_clean
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User role updated successfully.',
    'user_id', p_user_id,
    'old_role', v_target.role,
    'new_role', v_role_clean
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;

-- RPC Function: update_user_status
CREATE OR REPLACE FUNCTION public.update_user_status(
  p_user_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target RECORD;
  v_status_clean TEXT := LOWER(TRIM(COALESCE(p_status, '')));
  v_action_name TEXT;
BEGIN
  -- 1. Authentication check
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Verify caller role
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Administrative clearance required to modify account status.';
  END IF;

  -- 3. Validate status
  IF v_status_clean NOT IN ('active', 'suspended', 'disabled') THEN
    RAISE EXCEPTION 'Invalid status specified: %. Permitted statuses: active, suspended, disabled.', p_status;
  END IF;

  -- 4. Target user check
  SELECT * INTO v_target FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;

  -- 5. Permission matrix enforcement
  -- Emergency Admins CANNOT modify Super Admins or other Emergency Admins
  IF v_caller_role = 'emergency_admin' AND v_target.role IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Emergency Admins cannot modify status of Super Admins or Emergency Admins.';
  END IF;

  -- 6. Prevent self-status modification
  IF p_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Self-modification denied: Administrators cannot modify their own account status.';
  END IF;

  -- 7. Update user status
  UPDATE public.users
  SET status = v_status_clean, updated_at = now()
  WHERE id = p_user_id;

  -- 8. Determine audit action name
  IF v_status_clean = 'suspended' THEN
    v_action_name := 'user_suspended';
  ELSIF v_status_clean = 'disabled' THEN
    v_action_name := 'user_disabled';
  ELSE
    v_action_name := 'user_reactivated';
  END IF;

  -- 9. Insert audit entry
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    target_user_id,
    metadata
  ) VALUES (
    v_caller_id,
    v_action_name,
    p_user_id,
    jsonb_build_object(
      'target_email', v_target.email,
      'old_status', COALESCE(v_target.status, 'active'),
      'new_status', v_status_clean
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User account status updated successfully.',
    'user_id', p_user_id,
    'status', v_status_clean
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_status(UUID, TEXT) TO authenticated;

-- RPC Function: get_super_admin_stats / get_admin_user_stats
CREATE OR REPLACE FUNCTION public.get_super_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;

  v_total_users INT := 0;
  v_students_faculty INT := 0;
  v_doctors INT := 0;
  v_emergency_admins INT := 0;
  v_super_admins INT := 0;

  v_active_users INT := 0;
  v_suspended_users INT := 0;
  v_disabled_users INT := 0;

  v_pending_doctor_requests INT := 0;
  v_active_sos_alerts INT := 0;
  v_today_appointments INT := 0;
  v_today_incidents INT := 0;
  v_unread_notifications INT := 0;
  v_total_broadcasts INT := 0;
  v_total_health_records INT := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'emergency_admin') THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  -- User Role Counts
  SELECT COUNT(*) INTO v_total_users FROM public.users;
  SELECT COUNT(*) INTO v_students_faculty FROM public.users WHERE role = 'student_faculty';
  SELECT COUNT(*) INTO v_doctors FROM public.users WHERE role = 'doctor';
  SELECT COUNT(*) INTO v_emergency_admins FROM public.users WHERE role = 'emergency_admin';
  SELECT COUNT(*) INTO v_super_admins FROM public.users WHERE role = 'super_admin';

  -- User Account Status Counts
  SELECT COUNT(*) INTO v_active_users FROM public.users WHERE COALESCE(status, 'active') = 'active';
  SELECT COUNT(*) INTO v_suspended_users FROM public.users WHERE status = 'suspended';
  SELECT COUNT(*) INTO v_disabled_users FROM public.users WHERE status = 'disabled';

  -- Operations Counts
  SELECT COUNT(*) INTO v_pending_doctor_requests FROM public.doctor_access_requests WHERE status = 'pending';
  SELECT COUNT(*) INTO v_active_sos_alerts FROM public.sos_alerts WHERE status IN ('active', 'acknowledged');
  SELECT COUNT(*) INTO v_today_appointments FROM public.appointments WHERE appointment_date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_today_incidents FROM public.incident_reports WHERE created_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_unread_notifications FROM public.notifications WHERE is_read = false;
  SELECT COUNT(*) INTO v_total_broadcasts FROM public.broadcasts;
  SELECT COUNT(*) INTO v_total_health_records FROM public.health_records;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'students_faculty', v_students_faculty,
    'doctors', v_doctors,
    'emergency_admins', v_emergency_admins,
    'super_admins', v_super_admins,
    'active_users', v_active_users,
    'suspended_users', v_suspended_users,
    'disabled_users', v_disabled_users,
    'pending_doctor_requests', v_pending_doctor_requests,
    'active_sos_alerts', v_active_sos_alerts,
    'today_appointments', v_today_appointments,
    'today_incidents', v_today_incidents,
    'unread_notifications', v_unread_notifications,
    'total_broadcasts', v_total_broadcasts,
    'total_health_records', v_total_health_records
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_stats() TO authenticated;

-- ============================================================================
-- STEP 15: PRODUCTION SCHEDULED NOTIFICATION & REMINDER ENGINE
-- ============================================================================

-- 1. Schema Extensions for SOS Alerts & Notifications
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'delivered';

-- 2. Appointment Reminders Tracking Table (Idempotent / Duplicate Protection)
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
  sent_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_status TEXT NOT NULL DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  CONSTRAINT uq_app_reminder_type_user UNIQUE (appointment_id, reminder_type, sent_to_user_id)
);

-- Safety net: relax any legacy NOT NULL column on public.appointment_reminders that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'appointment_id', 'reminder_type', 'sent_to_user_id', 'sent_at', 'delivery_status'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointment_reminders'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.appointment_reminders ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: appointment_reminders.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.appointment_reminders already existed with a different/older shape.
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS reminder_type TEXT;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS sent_to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'delivered';
-- NOTE: appointment_reminders.appointment_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.
UPDATE public.appointment_reminders SET reminder_type = '' WHERE reminder_type IS NULL;
ALTER TABLE public.appointment_reminders ALTER COLUMN reminder_type SET NOT NULL;
-- NOTE: appointment_reminders.sent_to_user_id is NOT NULL with no default and no safe placeholder (FK/UUID) — left nullable for legacy-row safety; ensure your app always supplies it.

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_app_id ON public.appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_user_id ON public.appointment_reminders(sent_to_user_id);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own appointment reminders" ON public.appointment_reminders;
CREATE POLICY "Users can view own appointment reminders"
  ON public.appointment_reminders FOR SELECT TO authenticated
  USING (sent_to_user_id = auth.uid() OR public.is_admin());

-- 3. Scheduler Logs Table
CREATE TABLE IF NOT EXISTS public.scheduler_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminders_sent INT NOT NULL DEFAULT 0,
  sos_escalations INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  details JSONB DEFAULT '{}'::jsonb
);

-- Safety net: relax any legacy NOT NULL column on public.scheduler_logs that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'executed_at', 'reminders_sent', 'sos_escalations', 'status', 'details'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scheduler_logs'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.scheduler_logs ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: scheduler_logs.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.scheduler_logs already existed with a different/older shape.
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS reminders_sent INT DEFAULT 0;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS sos_escalations INT DEFAULT 0;
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
ALTER TABLE public.scheduler_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_scheduler_logs_executed_at ON public.scheduler_logs(executed_at DESC);

ALTER TABLE public.scheduler_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view scheduler logs" ON public.scheduler_logs;
CREATE POLICY "Admins can view scheduler logs"
  ON public.scheduler_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4. Server-Side Scheduled Tasks Function
CREATE OR REPLACE FUNCTION public.run_scheduled_tasks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app RECORD;
  v_sos RECORD;
  v_reminders_count INT := 0;
  v_sos_escalations INT := 0;
  v_now_bd TIMESTAMPTZ := now();
BEGIN
  -- Authorize manual execution if invoked via client RPC
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only emergency admins and super admins can execute scheduled tasks manually.';
  END IF;

  -- A. Process 24-Hour Appointment Reminders (For 'confirmed' appointments occurring within next 24 hours)
  FOR v_app IN
    SELECT 
      a.id, 
      a.student_id, 
      a.doctor_id, 
      a.appointment_date, 
      a.start_time, 
      a.end_time,
      d.user_id AS doctor_user_id, 
      d.full_name AS doctor_name, 
      d.department
    FROM public.appointments a
    JOIN public.doctors d ON d.id = a.doctor_id
    WHERE a.status = 'confirmed'
      AND (a.appointment_date + a.start_time)::timestamp BETWEEN (v_now_bd AT TIME ZONE 'Asia/Dhaka') AND (v_now_bd AT TIME ZONE 'Asia/Dhaka' + INTERVAL '24 hours')
  LOOP
    -- Student 24h reminder check
    IF NOT EXISTS (
      SELECT 1 FROM public.appointment_reminders 
      WHERE appointment_id = v_app.id AND reminder_type = '24h' AND sent_to_user_id = v_app.student_id
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, category, priority, delivery_status)
      VALUES (
        v_app.student_id,
        '24-Hour Consultation Reminder',
        'Reminder: You have a scheduled medical consultation with Dr. ' || COALESCE(v_app.doctor_name, 'Specialist') || ' on ' || v_app.appointment_date::text || ' at ' || to_char(v_app.start_time, 'HH12:MI AM') || '.',
        'appointment',
        'normal',
        'delivered'
      );

      INSERT INTO public.appointment_reminders (appointment_id, reminder_type, sent_to_user_id)
      VALUES (v_app.id, '24h', v_app.student_id)
      ON CONFLICT DO NOTHING;

      v_reminders_count := v_reminders_count + 1;
    END IF;

    -- Doctor 24h reminder check
    IF v_app.doctor_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.appointment_reminders 
      WHERE appointment_id = v_app.id AND reminder_type = '24h' AND sent_to_user_id = v_app.doctor_user_id
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, category, priority, delivery_status)
      VALUES (
        v_app.doctor_user_id,
        '24-Hour Patient Consultation Reminder',
        'Reminder: You have a scheduled patient consultation on ' || v_app.appointment_date::text || ' at ' || to_char(v_app.start_time, 'HH12:MI AM') || '.',
        'appointment',
        'normal',
        'delivered'
      );

      INSERT INTO public.appointment_reminders (appointment_id, reminder_type, sent_to_user_id)
      VALUES (v_app.id, '24h', v_app.doctor_user_id)
      ON CONFLICT DO NOTHING;

      v_reminders_count := v_reminders_count + 1;
    END IF;
  END LOOP;

  -- B. Process 1-Hour Appointment Reminders (For 'confirmed' appointments occurring within next 1 hour)
  FOR v_app IN
    SELECT 
      a.id, 
      a.student_id, 
      a.doctor_id, 
      a.appointment_date, 
      a.start_time, 
      a.end_time,
      d.user_id AS doctor_user_id, 
      d.full_name AS doctor_name, 
      d.department
    FROM public.appointments a
    JOIN public.doctors d ON d.id = a.doctor_id
    WHERE a.status = 'confirmed'
      AND (a.appointment_date + a.start_time)::timestamp BETWEEN (v_now_bd AT TIME ZONE 'Asia/Dhaka') AND (v_now_bd AT TIME ZONE 'Asia/Dhaka' + INTERVAL '1 hour')
  LOOP
    -- Student 1h reminder check
    IF NOT EXISTS (
      SELECT 1 FROM public.appointment_reminders 
      WHERE appointment_id = v_app.id AND reminder_type = '1h' AND sent_to_user_id = v_app.student_id
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, category, priority, delivery_status)
      VALUES (
        v_app.student_id,
        'Upcoming Consultation (Starting in 1 Hour)',
        'Reminder: Your appointment with Dr. ' || COALESCE(v_app.doctor_name, 'Specialist') || ' begins in approximately 1 hour at ' || to_char(v_app.start_time, 'HH12:MI AM') || '.',
        'appointment',
        'urgent',
        'delivered'
      );

      INSERT INTO public.appointment_reminders (appointment_id, reminder_type, sent_to_user_id)
      VALUES (v_app.id, '1h', v_app.student_id)
      ON CONFLICT DO NOTHING;

      v_reminders_count := v_reminders_count + 1;
    END IF;

    -- Doctor 1h reminder check
    IF v_app.doctor_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.appointment_reminders 
      WHERE appointment_id = v_app.id AND reminder_type = '1h' AND sent_to_user_id = v_app.doctor_user_id
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, category, priority, delivery_status)
      VALUES (
        v_app.doctor_user_id,
        'Patient Consultation Starting Soon (1 Hour)',
        'Reminder: Consultation scheduled for ' || to_char(v_app.start_time, 'HH12:MI AM') || ' begins in 1 hour.',
        'appointment',
        'urgent',
        'delivered'
      );

      INSERT INTO public.appointment_reminders (appointment_id, reminder_type, sent_to_user_id)
      VALUES (v_app.id, '1h', v_app.doctor_user_id)
      ON CONFLICT DO NOTHING;

      v_reminders_count := v_reminders_count + 1;
    END IF;
  END LOOP;

  -- C. Process SOS Escalation (Active SOS alerts unacknowledged > 10 minutes)
  FOR v_sos IN
    SELECT s.id, s.student_id, s.emergency_type, s.message, s.created_at, u.full_name AS student_name
    FROM public.sos_alerts s
    LEFT JOIN public.users u ON u.id = s.student_id
    WHERE s.status = 'active'
      AND s.created_at <= (now() - INTERVAL '10 minutes')
      AND COALESCE(s.is_escalated, false) = false
  LOOP
    -- Mark alert as escalated
    UPDATE public.sos_alerts
    SET is_escalated = true,
        escalated_at = now()
    WHERE id = v_sos.id;

    -- Send urgent notification to Emergency Admins & Super Admins
    INSERT INTO public.notifications (user_id, title, message, category, priority, delivery_status)
    SELECT
      u.id,
      'CRITICAL ESCALATION: Unacknowledged SOS Alert',
      'SOS emergency from ' || COALESCE(v_sos.student_name, 'Campus Student') || ' (' || UPPER(COALESCE(v_sos.emergency_type, 'General')) || ') has remained active & unacknowledged for over 10 minutes. Immediate dispatch required.',
      'emergency',
      'urgent',
      'delivered'
    FROM public.users u
    WHERE u.role IN ('emergency_admin', 'super_admin');

    v_sos_escalations := v_sos_escalations + 1;
  END LOOP;

  -- D. Log Execution Metrics
  INSERT INTO public.scheduler_logs (reminders_sent, sos_escalations, status, details)
  VALUES (
    v_reminders_count,
    v_sos_escalations,
    'success',
    jsonb_build_object(
      'executed_at', now(),
      'reminders_sent', v_reminders_count,
      'sos_escalations', v_sos_escalations
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'executed_at', now(),
    'reminders_sent', v_reminders_count,
    'sos_escalations', v_sos_escalations
  );

EXCEPTION WHEN OTHERS THEN
  -- Bounded failure recording in scheduler_task_failures
  INSERT INTO public.scheduler_task_failures (
    task_type,
    error_message,
    status,
    metadata
  ) VALUES (
    'run_scheduled_tasks',
    SQLERRM,
    'failed',
    jsonb_build_object('sqlstate', SQLSTATE, 'time', now())
  );

  -- Record critical event in system_health_events
  INSERT INTO public.system_health_events (
    event_type,
    severity,
    component,
    message,
    metadata
  ) VALUES (
    'SCHEDULER_EXCEPTION',
    'critical',
    'scheduler',
    'Scheduler execution encountered runtime error: ' || SQLERRM,
    jsonb_build_object('sqlstate', SQLSTATE)
  );

  -- Log failure in scheduler_logs
  INSERT INTO public.scheduler_logs (reminders_sent, sos_escalations, status, details)
  VALUES (
    v_reminders_count,
    v_sos_escalations,
    'failed',
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE,
    'reminders_sent', v_reminders_count,
    'sos_escalations', v_sos_escalations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_scheduled_tasks() TO authenticated;

-- 5. Scheduler Health Monitoring RPC Function
CREATE OR REPLACE FUNCTION public.get_scheduler_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_last_log RECORD;
  v_reminders_today INT := 0;
  v_escalations_today INT := 0;
  v_total_reminders_alltime INT := 0;
  v_recent_logs JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: Admin permissions required.';
  END IF;

  SELECT * INTO v_last_log
  FROM public.scheduler_logs
  ORDER BY executed_at DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_reminders_today
  FROM public.appointment_reminders
  WHERE sent_at::date = CURRENT_DATE;

  SELECT COUNT(*) INTO v_total_reminders_alltime
  FROM public.appointment_reminders;

  SELECT COUNT(*) INTO v_escalations_today
  FROM public.sos_alerts
  WHERE is_escalated = true AND escalated_at::date = CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) INTO v_recent_logs
  FROM (
    SELECT id, executed_at, reminders_sent, sos_escalations, status
    FROM public.scheduler_logs
    ORDER BY executed_at DESC
    LIMIT 10
  ) l;

  RETURN jsonb_build_object(
    'last_execution', CASE WHEN v_last_log.id IS NOT NULL THEN to_jsonb(v_last_log) ELSE NULL END,
    'reminders_sent_today', v_reminders_today,
    'total_reminders_alltime', v_total_reminders_alltime,
    'sos_escalations_today', v_escalations_today,
    'recent_logs', v_recent_logs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_scheduler_health() TO authenticated;

-- Realtime Publication for appointment_reminders & scheduler_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointment_reminders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_reminders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scheduler_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduler_logs;
  END IF;
END $$;

-- ============================================================================
-- STEP 18: ADVANCED MONITORING, RELIABILITY & FAILURE RECOVERY

-- 1. System Health Events Table
CREATE TABLE IF NOT EXISTS public.system_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  component TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safety net: relax any legacy NOT NULL column on public.system_health_events that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'event_type', 'severity', 'component', 'message', 'metadata', 'resolved', 'resolved_at', 'resolved_by', 'created_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_health_events'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.system_health_events ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: system_health_events.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.system_health_events already existed with a different/older shape.
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS component TEXT;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.users(id);
ALTER TABLE public.system_health_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
UPDATE public.system_health_events SET event_type = '' WHERE event_type IS NULL;
ALTER TABLE public.system_health_events ALTER COLUMN event_type SET NOT NULL;
UPDATE public.system_health_events SET severity = '' WHERE severity IS NULL;
ALTER TABLE public.system_health_events ALTER COLUMN severity SET NOT NULL;
UPDATE public.system_health_events SET component = '' WHERE component IS NULL;
ALTER TABLE public.system_health_events ALTER COLUMN component SET NOT NULL;
UPDATE public.system_health_events SET message = '' WHERE message IS NULL;
ALTER TABLE public.system_health_events ALTER COLUMN message SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_health_events_created_at ON public.system_health_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_events_severity ON public.system_health_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_health_events_component ON public.system_health_events(component);
CREATE INDEX IF NOT EXISTS idx_system_health_events_resolved ON public.system_health_events(resolved);
CREATE INDEX IF NOT EXISTS idx_system_health_events_event_type ON public.system_health_events(event_type);

ALTER TABLE public.system_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view system health events" ON public.system_health_events;
CREATE POLICY "Admins can view system health events"
  ON public.system_health_events FOR SELECT TO authenticated
  USING (public.is_admin());

-- 2. Scheduler Task Failures Table
CREATE TABLE IF NOT EXISTS public.scheduler_task_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  reference_id UUID,
  error_message TEXT NOT NULL,
  error_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'failed' CHECK (status IN ('failed', 'retrying', 'resolved')),
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safety net: relax any legacy NOT NULL column on public.scheduler_task_failures that this schema
-- doesn't know about and doesn't populate (e.g. an old required column left over
-- from a previous version of this table), so it can't block inserts this script
-- or its RPC functions perform.
DO $$
DECLARE
  r RECORD;
  expected TEXT[] := ARRAY['id', 'task_type', 'reference_id', 'error_message', 'error_code', 'attempt_count', 'status', 'next_retry_at', 'resolved_at', 'metadata', 'created_at', 'updated_at'];
BEGIN
  FOR r IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scheduler_task_failures'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name <> ALL(expected)
  LOOP
    EXECUTE format('ALTER TABLE public.scheduler_task_failures ALTER COLUMN %I DROP NOT NULL', r.column_name);
    RAISE NOTICE 'Relaxed unexpected NOT NULL column: scheduler_task_failures.%', r.column_name;
  END LOOP;
END $$;


-- Defensive column patch: backfills any column this schema depends on in case
-- public.scheduler_task_failures already existed with a different/older shape.
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS task_type TEXT;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'failed';
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.scheduler_task_failures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE public.scheduler_task_failures SET task_type = '' WHERE task_type IS NULL;
ALTER TABLE public.scheduler_task_failures ALTER COLUMN task_type SET NOT NULL;
UPDATE public.scheduler_task_failures SET error_message = '' WHERE error_message IS NULL;
ALTER TABLE public.scheduler_task_failures ALTER COLUMN error_message SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduler_failures_status ON public.scheduler_task_failures(status);
CREATE INDEX IF NOT EXISTS idx_scheduler_failures_task_type ON public.scheduler_task_failures(task_type);
CREATE INDEX IF NOT EXISTS idx_scheduler_failures_created ON public.scheduler_task_failures(created_at DESC);

ALTER TABLE public.scheduler_task_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view scheduler task failures" ON public.scheduler_task_failures;
CREATE POLICY "Admins can view scheduler task failures"
  ON public.scheduler_task_failures FOR SELECT TO authenticated
  USING (public.is_admin());

-- 3. System Health Overview RPC Function
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_last_log RECORD;
  v_last_success_log RECORD;
  v_last_failed_log RECORD;
  v_runs_today INT := 0;
  v_failures_today INT := 0;
  v_reminders_today INT := 0;
  v_sos_escalations_today INT := 0;
  v_unresolved_health_events JSONB;
  v_unresolved_critical_count INT := 0;
  v_failed_tasks_count INT := 0;
  v_active_sos_count INT := 0;
  v_unacknowledged_sos_count INT := 0;
  v_escalated_sos_count INT := 0;
  v_notifs_today INT := 0;
  v_notif_failures_today INT := 0;
  v_status TEXT := 'HEALTHY';
  v_status_reason TEXT := 'System operational. Scheduler executing normally.';
  v_minutes_since_last_run NUMERIC := NULL;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: Admin permissions required.';
  END IF;

  -- Scheduler metrics
  SELECT * INTO v_last_log FROM public.scheduler_logs ORDER BY executed_at DESC LIMIT 1;
  SELECT * INTO v_last_success_log FROM public.scheduler_logs WHERE status = 'success' ORDER BY executed_at DESC LIMIT 1;
  SELECT * INTO v_last_failed_log FROM public.scheduler_logs WHERE status <> 'success' ORDER BY executed_at DESC LIMIT 1;

  SELECT COUNT(*) INTO v_runs_today FROM public.scheduler_logs WHERE executed_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_failures_today FROM public.scheduler_logs WHERE executed_at::date = CURRENT_DATE AND status <> 'success';

  -- Reminders & SOS metrics
  SELECT COUNT(*) INTO v_reminders_today FROM public.appointment_reminders WHERE sent_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_sos_escalations_today FROM public.sos_alerts WHERE is_escalated = true AND escalated_at::date = CURRENT_DATE;

  -- Unresolved health events
  SELECT COUNT(*) INTO v_unresolved_critical_count FROM public.system_health_events WHERE resolved = false AND severity = 'critical';

  SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) INTO v_unresolved_health_events
  FROM (
    SELECT id, event_type, severity, component, message, metadata, created_at
    FROM public.system_health_events
    WHERE resolved = false
    ORDER BY created_at DESC
    LIMIT 20
  ) e;

  -- Failed scheduler tasks count
  SELECT COUNT(*) INTO v_failed_tasks_count FROM public.scheduler_task_failures WHERE status IN ('failed', 'retrying');

  -- SOS Metrics
  SELECT COUNT(*) INTO v_active_sos_count FROM public.sos_alerts WHERE status IN ('active', 'acknowledged');
  SELECT COUNT(*) INTO v_unacknowledged_sos_count FROM public.sos_alerts WHERE status = 'active';
  SELECT COUNT(*) INTO v_escalated_sos_count FROM public.sos_alerts WHERE is_escalated = true AND status IN ('active', 'acknowledged');

  -- Notifications metrics
  SELECT COUNT(*) INTO v_notifs_today FROM public.notifications WHERE created_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_notif_failures_today FROM public.notifications WHERE created_at::date = CURRENT_DATE AND delivery_status = 'failed';

  -- Health Status Calculation
  IF v_last_success_log.id IS NOT NULL THEN
    v_minutes_since_last_run := ROUND(EXTRACT(EPOCH FROM (now() - v_last_success_log.executed_at)) / 60, 1);
  END IF;

  IF v_last_success_log.id IS NULL OR (v_minutes_since_last_run IS NOT NULL AND v_minutes_since_last_run > 15) THEN
    v_status := 'CRITICAL';
    v_status_reason := 'CRITICAL: Scheduler has not completed successfully in ' || COALESCE(v_minutes_since_last_run::text, 'unknown') || ' minutes.';
  ELSIF v_unresolved_critical_count > 0 THEN
    v_status := 'CRITICAL';
    v_status_reason := 'CRITICAL: ' || v_unresolved_critical_count || ' unresolved critical system health event(s) pending.';
  ELSIF v_failures_today > 0 OR v_failed_tasks_count > 0 OR v_unacknowledged_sos_count > 2 THEN
    v_status := 'DEGRADED';
    v_status_reason := 'DEGRADED: Recent scheduler or task failures detected, or unacknowledged SOS alert backlog.';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'status_reason', v_status_reason,
    'last_execution', CASE WHEN v_last_log.id IS NOT NULL THEN to_jsonb(v_last_log) ELSE NULL END,
    'last_success_execution', CASE WHEN v_last_success_log.id IS NOT NULL THEN to_jsonb(v_last_success_log) ELSE NULL END,
    'last_failed_execution', CASE WHEN v_last_failed_log.id IS NOT NULL THEN to_jsonb(v_last_failed_log) ELSE NULL END,
    'runs_today', v_runs_today,
    'failures_today', v_failures_today,
    'reminders_sent_today', v_reminders_today,
    'sos_escalations_today', v_sos_escalations_today,
    'unresolved_critical_events_count', v_unresolved_critical_count,
    'unresolved_health_events', v_unresolved_health_events,
    'failed_tasks_count', v_failed_tasks_count,
    'active_sos_count', v_active_sos_count,
    'unacknowledged_sos_count', v_unacknowledged_sos_count,
    'escalated_sos_count', v_escalated_sos_count,
    'notifications_today', v_notifs_today,
    'notification_failures_today', v_notif_failures_today
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_health() TO authenticated;

-- 4. Resolve System Health Event RPC Function
CREATE OR REPLACE FUNCTION public.resolve_system_health_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_event RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: Admin permissions required.';
  END IF;

  SELECT * INTO v_event FROM public.system_health_events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Health event not found.';
  END IF;

  IF v_event.resolved THEN
    RETURN jsonb_build_object('success', true, 'message', 'Event already resolved.');
  END IF;

  UPDATE public.system_health_events
  SET resolved = true,
      resolved_at = now(),
      resolved_by = v_caller_id
  WHERE id = p_event_id;

  -- Log admin audit entry (log_admin_audit signature: action, target_user_id, metadata)
  PERFORM public.log_admin_audit(
    'RESOLVE_HEALTH_EVENT',
    NULL,
    jsonb_build_object(
      'event_id', p_event_id,
      'event_type', v_event.event_type,
      'component', v_event.component,
      'message', 'System health event resolved: ' || v_event.event_type || ' (' || v_event.component || ')'
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'System health event resolved successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_system_health_event(UUID) TO authenticated;

-- Realtime Publication for Step 18 tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_health_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_health_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scheduler_task_failures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduler_task_failures;
  END IF;
END $$;

-- SUPABASE CRON MANUAL CONFIGURATION INSTRUCTIONS:
-- To configure automatic server-side scheduling via Supabase pg_cron extension:
-- 1. Open Supabase Dashboard -> Database -> Extensions -> Search "pg_cron" -> Enable extension.
-- 2. Open SQL Editor in Supabase Dashboard and run:
--    SELECT cron.schedule(
--      'campuscare_reminder_job',
--      '*/5 * * * *',
--      'SELECT public.run_scheduled_tasks()'
--    );
-- 3. To verify active cron schedules in Supabase:
--    SELECT * FROM cron.job;
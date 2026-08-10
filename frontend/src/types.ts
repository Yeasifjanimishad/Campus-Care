/**
 * Types for CampusCare Application
 */

export type UserRole = 
  | 'student_faculty' 
  | 'doctor' 
  | 'emergency_admin' 
  | 'super_admin';

export type AppNavId = 'dashboard' | 'appointments' | 'alerts' | 'reports' | 'records' | 'notifications' | 'profile';

export type PageRoute = 
  | 'landing' 
  | 'login' 
  | 'signup' 
  | 'doctor/request-access'
  | 'dashboard'
  | 'dashboard/student'
  | 'dashboard/doctor'
  | 'dashboard/admin'
  | 'dashboard/super-admin';

export interface UserProfile {
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  initials: string;
  universityId: string;
  department?: string;
  phone?: string;
}

export interface DoctorAccessRequest {
  id: string;
  full_name: string;
  email: string;
  doctor_id: string;
  department: string;
  phone?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_note?: string;
}

export interface AuthModalState {
  isOpen: boolean;
  mode: 'login' | 'signup';
  initialRole?: UserRole;
}

export interface Doctor {
  id: string;
  user_id?: string | null;
  doctor_id: string;
  full_name: string;
  email: string;
  department: string;
  specialization: string;
  phone?: string | null;
  designation?: string | null;
  room_number?: string | null;
  available_days?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  profile_image_url?: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'rejected';

export interface Appointment {
  id: string;
  student_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  symptoms?: string | null;
  status: AppointmentStatus;
  student_note?: string | null;
  doctor_note?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined objects
  doctors?: Doctor;
  doctor?: Doctor;
  student?: {
    id?: string;
    name?: string;
    email?: string;
    university_id?: string;
    department?: string;
    phone?: string;
  };
}

export type SosAlertStatus = 'active' | 'acknowledged' | 'resolved' | 'cancelled';

export interface SosAlert {
  id: string;
  student_id: string;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  status: SosAlertStatus;
  emergency_type?: string | null;
  message?: string | null;
  resolution_note?: string | null;
  created_at: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  // Joined student info
  student?: {
    id?: string;
    name?: string;
    email?: string;
    university_id?: string;
    department?: string;
    phone?: string;
  };
}

export type IncidentReportStatus = 'submitted' | 'under_review' | 'resolved' | 'rejected';
export type IncidentCategory = 'Medical' | 'Safety' | 'Campus Facility' | 'Harassment/Concern' | 'Other';

export interface IncidentReport {
  id: string;
  reporter_id: string;
  category: IncidentCategory;
  title: string;
  description: string;
  incident_date: string;
  incident_time?: string | null;
  location?: string | null;
  evidence_urls: string[];
  status: IncidentReportStatus;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  // Joined reporter info
  reporter?: {
    id?: string;
    name?: string;
    email?: string;
    university_id?: string;
    department?: string;
    phone?: string;
  };
}

export interface HealthRecord {
  id: string;
  student_id: string;
  doctor_id: string;
  appointment_id?: string | null;
  diagnosis: string;
  clinical_summary?: string | null;
  prescription?: string | null;
  treatment_plan?: string | null;
  follow_up_instructions?: string | null;
  doctor_note?: string | null;
  created_at: string;
  updated_at: string;
  last_updated_by?: string | null;
  // Joined doctor object
  doctor?: Doctor;
  // Joined student object
  student?: {
    id?: string;
    name?: string;
    email?: string;
    university_id?: string;
    department?: string;
    phone?: string;
  };
  // Joined appointment object
  appointment?: Appointment;
}

export type BroadcastCategory = 'general' | 'health' | 'emergency' | 'appointment' | 'safety' | 'campus';
export type BroadcastPriority = 'low' | 'normal' | 'high' | 'urgent';
export type BroadcastTargetRole = 'all' | 'student_faculty' | 'doctor' | 'emergency_admin' | 'super_admin';

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  category: BroadcastCategory;
  priority: BroadcastPriority;
  target_role: BroadcastTargetRole;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    name?: string;
    email?: string;
  };
  recipient_count?: number;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  broadcast_id?: string | null;
  title: string;
  message: string;
  category: BroadcastCategory;
  priority: BroadcastPriority;
  is_read: boolean;
  delivery_status?: 'pending' | 'delivered' | 'failed';
  created_at: string;
  read_at?: string | null;
}

export interface AppointmentReminder {
  id: string;
  appointment_id: string;
  reminder_type: '24h' | '1h';
  sent_to_user_id: string;
  sent_at: string;
  delivery_status: 'pending' | 'delivered' | 'failed';
}

export interface SchedulerLog {
  id: string;
  executed_at: string;
  reminders_sent: number;
  sos_escalations: number;
  status: string;
  details?: Record<string, any>;
}

export interface AdminAuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  target_user_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  actor?: {
    name?: string;
    email?: string;
    role?: UserRole;
  };
  target_user?: {
    name?: string;
    email?: string;
    role?: UserRole;
  };
}

export interface SuperAdminStats {
  total_users: number;
  students_faculty: number;
  doctors: number;
  emergency_admins: number;
  super_admins: number;
  pending_doctor_requests: number;
  active_sos_alerts: number;
  today_appointments: number;
  today_incidents: number;
  unread_notifications: number;
  total_broadcasts: number;
  total_health_records: number;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  university_id?: string;
  role: UserRole;
  department?: string;
  phone?: string;
  status?: 'active' | 'suspended' | 'disabled';
  created_at?: string;
  updated_at?: string;
}

export interface SystemHealthEvent {
  id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
}

export interface SchedulerTaskFailure {
  id: string;
  task_type: string;
  reference_id?: string | null;
  error_message: string;
  error_code?: string | null;
  attempt_count: number;
  status: 'failed' | 'retrying' | 'resolved';
  next_retry_at?: string | null;
  resolved_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SystemHealthOverview {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  status_reason: string;
  last_execution?: {
    id: string;
    executed_at: string;
    reminders_sent: number;
    sos_escalations: number;
    status: string;
    details?: any;
  } | null;
  last_success_execution?: {
    id: string;
    executed_at: string;
    reminders_sent: number;
    sos_escalations: number;
    status: string;
  } | null;
  last_failed_execution?: {
    id: string;
    executed_at: string;
    status: string;
    details?: any;
  } | null;
  runs_today: number;
  failures_today: number;
  reminders_sent_today: number;
  sos_escalations_today: number;
  unresolved_critical_events_count: number;
  unresolved_health_events: SystemHealthEvent[];
  failed_tasks_count: number;
  active_sos_count: number;
  unacknowledged_sos_count: number;
  escalated_sos_count: number;
  notifications_today: number;
  notification_failures_today: number;
}



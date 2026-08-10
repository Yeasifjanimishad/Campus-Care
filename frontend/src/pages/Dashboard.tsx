import React from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { 
  CalendarDays, 
  ShieldAlert, 
  FileText, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Stethoscope,
  Users,
  Activity,
  Clock
} from 'lucide-react';
import { AppNavId, PageRoute, UserProfile } from '../types';
import { DoctorAccessRequestsAdmin } from '../components/DoctorAccessRequestsAdmin';
import { DoctorDirectory } from '../components/DoctorDirectory';
import { StudentAppointmentBooking } from '../components/StudentAppointmentBooking';
import { StudentAppointmentsList } from '../components/StudentAppointmentsList';
import { DoctorAppointmentsManager } from '../components/DoctorAppointmentsManager';
import { StudentSosManager } from '../components/StudentSosManager';
import { AdminSosMonitor } from '../components/AdminSosMonitor';
import { StudentIncidentReporting } from '../components/StudentIncidentReporting';
import { AdminIncidentManager } from '../components/AdminIncidentManager';
import { StudentHealthRecords } from '../components/StudentHealthRecords';
import { DoctorHealthRecords } from '../components/DoctorHealthRecords';
import { StudentNotificationsView } from '../components/StudentNotificationsView';
import { AdminBroadcastManager } from '../components/AdminBroadcastManager';
import { SuperAdminDashboard } from '../components/SuperAdminDashboard';
import { AdminUserManager } from '../components/AdminUserManager';
import { AdminAuditLogViewer } from '../components/AdminAuditLogViewer';
import { AdminPriorityOverview } from '../components/AdminPriorityOverview';
import { AdminSchedulerMonitor } from '../components/AdminSchedulerMonitor';
import { AdminSystemHealth } from '../components/AdminSystemHealth';

interface DashboardPageProps {
  onNavigateRoute: (route: PageRoute) => void;
  activeNav: AppNavId;
  onNavChange: (nav: AppNavId) => void;
  user?: UserProfile;
  onLogout?: () => void;
}

const defaultUser: UserProfile = {
  name: 'Alex Morgan',
  email: 'alex.morgan@university.edu',
  role: 'student_faculty',
  roleLabel: 'Student / Faculty',
  initials: 'AM',
  universityId: '90384102',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateRoute,
  activeNav,
  onNavChange,
  user = defaultUser,
  onLogout,
}) => {
  const isAdmin = user.role === 'super_admin' || user.role === 'emergency_admin';
  const isDoctor = user.role === 'doctor';
  const [appointmentTab, setAppointmentTab] = React.useState<'booking' | 'my-appointments' | 'directory'>('booking');

  return (
    <AppLayout
      activeNav={activeNav}
      onNavChange={onNavChange}
      user={user}
      onLogout={onLogout || (() => onNavigateRoute('landing'))}
    >
      <div className="space-y-8">
        
        {/* Welcome Banner */}
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-medical/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-wellness/10 text-wellness text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Campus Services Operational</span>
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink">
                Welcome back, {user.name}
              </h1>
              <p className="text-sm text-ink-muted">
                Logged in as <span className="font-semibold text-ink">{user.roleLabel}</span> ({user.email})
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {isDoctor && (
                <div className="px-3.5 py-2 rounded-xl bg-wellness/10 border border-wellness/30 text-wellness text-xs font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span>On-Call Medical Staff</span>
                </div>
              )}
              {isAdmin && (
                <div className="px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Admin Console</span>
                </div>
              )}
              <button
                onClick={() => onNavChange('alerts')}
                type="button"
                className="px-4 py-2.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs font-semibold hover:bg-emergency hover:text-surface transition-all focus-ring cursor-pointer"
              >
                Trigger SOS Alert
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Nav View Render */}
        {activeNav === 'dashboard' && (
          <div className="space-y-8">
            {/* Live Priority Matrix for Emergency Admins and Super Admins */}
            {isAdmin && (
              <div className="space-y-8">
                <section aria-label="Campus Priority Matrix Overview">
                  <AdminPriorityOverview user={user} onNavigateSection={(nav) => onNavChange(nav as AppNavId)} />
                </section>
                <section aria-label="Scheduled Notification & Reminder Engine Health">
                  <AdminSchedulerMonitor user={user} />
                </section>
                <section aria-label="Production System Health & Operations Monitoring">
                  <AdminSystemHealth />
                </section>
              </div>
            )}

            {/* Super Admin Dashboard */}
            {user.role === 'super_admin' && (
              <section aria-label="Super Admin Dashboard">
                <SuperAdminDashboard user={user} />
              </section>
            )}

            {/* Emergency Admin Dashboard */}
            {user.role === 'emergency_admin' && (
              <div className="space-y-8">
                <section aria-label="Live Emergency SOS Monitor">
                  <AdminSosMonitor user={user} />
                </section>

                <section aria-label="Campus Incident Management">
                  <AdminIncidentManager user={user} />
                </section>

                <section aria-label="System User Management Directory">
                  <AdminUserManager user={user} />
                </section>

                <section aria-label="Admin Management">
                  <DoctorAccessRequestsAdmin />
                </section>

                <section aria-label="Security Audit Logs & Governance Trail">
                  <AdminAuditLogViewer user={user} />
                </section>
              </div>
            )}

            {/* Doctor Dashboard */}
            {isDoctor && (
              <section aria-label="Doctor Appointments Management">
                <DoctorAppointmentsManager user={user} />
              </section>
            )}

            {/* Student Dashboard */}
            {user.role === 'student_faculty' && (
              <section aria-label="Student Emergency SOS">
                <StudentSosManager user={user} />
              </section>
            )}

            {/* Standard Campus Care Modules */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold text-lg text-ink">
                  Active Campus Care Modules
                </h2>
                <span className="text-xs text-ink-muted font-mono">Verified Campus Operations</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Card 1: Medical Appointments */}
                <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 flex flex-col justify-between hover:border-medical/50 transition-colors shadow-2xs">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-medical/10 text-medical flex items-center justify-center">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <h3 className="font-heading font-semibold text-base text-ink">
                      Appointments & Consultations
                    </h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Book 30-minute consultation slots with verified campus physicians and manage your appointments.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-wellness/10 text-wellness text-2xs font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Booking Active
                    </span>
                    <button 
                      onClick={() => {
                        onNavChange('appointments');
                        setAppointmentTab('booking');
                      }} 
                      type="button"
                      className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Book Slot</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Card 2: Emergency SOS Dispatch */}
                <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 flex flex-col justify-between hover:border-emergency/50 transition-colors shadow-2xs">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emergency/10 text-emergency flex items-center justify-center">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <h3 className="font-heading font-semibold text-base text-ink">
                      Emergency Dispatch & Alerts
                    </h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Real-time campus security distress alerts with browser GPS coordinate capture & live admin dispatch.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emergency/10 text-emergency text-2xs font-bold">
                      <ShieldAlert className="w-3 h-3" /> Dispatch Online
                    </span>
                    <button 
                      onClick={() => onNavChange('alerts')} 
                      type="button"
                      className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isAdmin ? 'Open Monitor' : 'Trigger SOS'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Card 3: Campus Incident Reporting */}
                <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-2xs">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h3 className="font-heading font-semibold text-base text-ink">
                      Incident Reporting & Photo Upload
                    </h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Report non-emergency medical, safety, facility, or concern incidents with evidence photo upload.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-2xs font-bold">
                      <FileText className="w-3 h-3" /> System Active
                    </span>
                    <button 
                      onClick={() => onNavChange('reports')} 
                      type="button"
                      className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isAdmin ? 'Manage Reports' : 'Report Incident'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Card 4: Health & Clinical Records */}
                <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 flex flex-col justify-between hover:border-medical/50 transition-colors shadow-2xs">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-medical/10 text-medical flex items-center justify-center">
                      <Activity className="w-5 h-5" />
                    </div>
                    <h3 className="font-heading font-semibold text-base text-ink">
                      Clinical Health Records
                    </h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Confidential patient medical records, physician diagnosis notes, and prescriptions.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-wellness/10 text-wellness text-2xs font-bold">
                      <Activity className="w-3 h-3" /> Encrypted & RLS
                    </span>
                    <button 
                      onClick={() => onNavChange('records')} 
                      type="button"
                      className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isDoctor ? 'Manage Patient Records' : 'View My Records'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Doctor Directory Section */}
            <section aria-label="Campus Care Doctor Directory">
              <DoctorDirectory user={user} />
            </section>
          </div>
        )}

        {/* Appointments Nav View */}
        {activeNav === 'appointments' && (
          isDoctor ? (
            <DoctorAppointmentsManager user={user} />
          ) : (
            <div className="space-y-6">
              {/* Top Sub-Navigation Tabs */}
              <div className="bg-surface rounded-2xl border border-border p-2 flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAppointmentTab('booking')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    appointmentTab === 'booking'
                      ? 'bg-medical text-surface shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>Book Appointment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAppointmentTab('my-appointments')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    appointmentTab === 'my-appointments'
                      ? 'bg-medical text-surface shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>My Appointments</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAppointmentTab('directory')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    appointmentTab === 'directory'
                      ? 'bg-medical text-surface shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
                  }`}
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>Doctor Directory</span>
                </button>
              </div>

              {/* Sub-Tab Views */}
              {appointmentTab === 'booking' && (
                <StudentAppointmentBooking
                  user={user}
                  onBookingSuccess={() => setAppointmentTab('my-appointments')}
                />
              )}

              {appointmentTab === 'my-appointments' && (
                <StudentAppointmentsList
                  user={user}
                  onNavigateToBooking={() => setAppointmentTab('booking')}
                />
              )}

              {appointmentTab === 'directory' && <DoctorDirectory user={user} />}
            </div>
          )
        )}

        {/* Alerts Nav View */}
        {activeNav === 'alerts' && (
          isAdmin ? (
            <AdminSosMonitor user={user} />
          ) : (
            <StudentSosManager user={user} />
          )
        )}

        {/* Reports Nav View */}
        {activeNav === 'reports' && (
          isAdmin ? (
            <AdminIncidentManager user={user} />
          ) : (
            <StudentIncidentReporting user={user} />
          )
        )}

        {/* Health Records Nav View */}
        {activeNav === 'records' && (
          isDoctor ? (
            <DoctorHealthRecords user={user} />
          ) : (
            <StudentHealthRecords user={user} />
          )
        )}

        {/* Notifications / Announcements Nav View */}
        {activeNav === 'notifications' && (
          isAdmin ? (
            <AdminBroadcastManager user={user} />
          ) : (
            <StudentNotificationsView user={user} />
          )
        )}

        {/* Profile Nav View */}
        {activeNav === 'profile' && (
          <div className="bg-surface rounded-2xl border border-border p-8 text-center space-y-4 max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-semibold text-xl text-ink capitalize">
                {activeNav} Module
              </h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
                You are viewing your CampusCare profile settings for account <strong className="text-ink">{user.name}</strong> ({user.email}).
              </p>
            </div>
            <button
              onClick={() => onNavChange('dashboard')}
              type="button"
              className="px-4 py-2 rounded-xl bg-primary text-surface font-semibold text-xs hover:bg-primary-hover transition-colors focus-ring"
            >
              Return to Dashboard
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

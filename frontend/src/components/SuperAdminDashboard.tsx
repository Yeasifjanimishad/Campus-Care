import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SuperAdminStats, UserProfile } from '../types';
import { SuperAdminUserManager } from './SuperAdminUserManager';
import { SuperAdminAuditLog } from './SuperAdminAuditLog';
import { AdminSosMonitor } from './AdminSosMonitor';
import { DoctorAccessRequestsAdmin } from './DoctorAccessRequestsAdmin';
import { AdminBroadcastManager } from './AdminBroadcastManager';
import { 
  Users, 
  ShieldAlert, 
  ShieldCheck, 
  Stethoscope, 
  CalendarDays, 
  FileText, 
  Bell, 
  History, 
  Megaphone, 
  Activity, 
  RefreshCw,
  AlertCircle,
  GraduationCap
} from 'lucide-react';

interface SuperAdminDashboardProps {
  user: UserProfile;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'sos' | 'doctors' | 'broadcasts'>('users');
  const [stats, setStats] = useState<SuperAdminStats>({
    total_users: 0,
    students_faculty: 0,
    doctors: 0,
    emergency_admins: 0,
    super_admins: 0,
    pending_doctor_requests: 0,
    active_sos_alerts: 0,
    today_appointments: 0,
    today_incidents: 0,
    unread_notifications: 0,
    total_broadcasts: 0,
    total_health_records: 0
  });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    setStatsError(null);

    if (!isSupabaseConfigured) {
      setStatsError('Supabase authentication is not configured. Please verify environment variables.');
      setLoadingStats(false);
      return;
    }

    try {
      const { data, error: rpcErr } = await supabase.rpc('get_super_admin_stats');

      if (!rpcErr && data) {
        setStats(data as SuperAdminStats);
        setLoadingStats(false);
        return;
      }

      if (rpcErr) {
        console.warn('[SuperAdminDashboard] RPC get_super_admin_stats notice:', rpcErr.message);
      }

      // Fallback to direct table count queries
      const [
        { count: totalUsers, error: err1 },
        { count: studentCount },
        { count: doctorCount },
        { count: emergencyAdminCount },
        { count: superAdminCount },
        { count: doctorReqCount },
        { count: activeSosCount },
        { count: todayApptCount },
        { count: todayIncCount },
        { count: unreadNotifCount },
        { count: broadcastsCount },
        { count: healthRecordsCount }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student_faculty'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'emergency_admin'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'super_admin'),
        supabase.from('doctor_access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('sos_alerts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('incident_reports').select('*', { count: 'exact', head: true }),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('broadcasts').select('*', { count: 'exact', head: true }),
        supabase.from('health_records').select('*', { count: 'exact', head: true }),
      ]);

      if (err1) {
        setStatsError('Error querying database statistics: ' + err1.message);
      } else {
        setStats({
          total_users: totalUsers || 0,
          students_faculty: studentCount || 0,
          doctors: doctorCount || 0,
          emergency_admins: emergencyAdminCount || 0,
          super_admins: superAdminCount || 0,
          pending_doctor_requests: doctorReqCount || 0,
          active_sos_alerts: activeSosCount || 0,
          today_appointments: todayApptCount || 0,
          today_incidents: todayIncCount || 0,
          unread_notifications: unreadNotifCount || 0,
          total_broadcasts: broadcastsCount || 0,
          total_health_records: healthRecordsCount || 0
        });
      }
    } catch (err: any) {
      console.warn('[SuperAdminDashboard] Exception in fetchStats:', err?.message || err);
      setStatsError('Unable to connect to database: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Subscribe to realtime updates for stats
    if (isSupabaseConfigured) {
      const channelName = `super_admin_stats_${Math.random().toString(36).substring(2, 9)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchStats)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, fetchStats)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_access_requests' }, fetchStats)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchStats)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user.role]);

  return (
    <div className="space-y-8">
      {statsError && (
        <div className="p-4 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-sm flex items-center justify-between">
          <span>{statsError}</span>
          <button
            onClick={fetchStats}
            type="button"
            className="px-3 py-1 bg-emergency text-surface rounded-lg text-xs font-semibold hover:bg-emergency/90 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}
      
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Users */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-1 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <p className="font-heading font-bold text-2xl text-ink">
            {loadingStats ? '...' : stats.total_users}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-ink-muted">
            <span className="font-semibold text-wellness">{stats.students_faculty} Students</span>
            <span>•</span>
            <span className="font-semibold text-medical">{stats.doctors} Doctors</span>
          </div>
        </div>

        {/* Emergency SOS Alerts */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-1 shadow-2xs hover:border-emergency/40 transition-colors">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active SOS</span>
            <ShieldAlert className="w-4 h-4 text-emergency animate-pulse" />
          </div>
          <p className="font-heading font-bold text-2xl text-emergency">
            {loadingStats ? '...' : stats.active_sos_alerts}
          </p>
          <span className="text-[10px] text-ink-muted font-mono">Live Emergency Triage</span>
        </div>

        {/* Doctor Access Requests */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-1 shadow-2xs hover:border-medical/40 transition-colors">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Doctor Requests</span>
            <Stethoscope className="w-4 h-4 text-medical" />
          </div>
          <p className="font-heading font-bold text-2xl text-ink">
            {loadingStats ? '...' : stats.pending_doctor_requests}
          </p>
          <span className="text-[10px] text-ink-muted font-mono">Pending Approvals</span>
        </div>

        {/* Today's Appointments */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-1 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Visits</span>
            <CalendarDays className="w-4 h-4 text-primary" />
          </div>
          <p className="font-heading font-bold text-2xl text-ink">
            {loadingStats ? '...' : stats.today_appointments}
          </p>
          <span className="text-[10px] text-ink-muted font-mono">Clinic Consultations</span>
        </div>

        {/* Incident Reports */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-1 shadow-2xs hover:border-wellness/40 transition-colors">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Reports</span>
            <FileText className="w-4 h-4 text-wellness" />
          </div>
          <p className="font-heading font-bold text-2xl text-ink">
            {loadingStats ? '...' : stats.today_incidents}
          </p>
          <span className="text-[10px] text-ink-muted font-mono">Evidence Logged</span>
        </div>

        {/* Broadcasts Sent */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-1 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Broadcasts</span>
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <p className="font-heading font-bold text-2xl text-ink">
            {loadingStats ? '...' : stats.total_broadcasts}
          </p>
          <span className="text-[10px] text-ink-muted font-mono">Campus Dispatches</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-surface rounded-2xl border border-border p-2 flex flex-wrap items-center gap-2 shadow-2xs">
        <button
          onClick={() => setActiveTab('users')}
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all focus-ring cursor-pointer ${
            activeTab === 'users'
              ? 'bg-primary text-surface shadow-2xs'
              : 'text-ink-muted hover:bg-background hover:text-ink'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Management & Roles</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all focus-ring cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-primary text-surface shadow-2xs'
              : 'text-ink-muted hover:bg-background hover:text-ink'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('sos')}
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all focus-ring cursor-pointer relative ${
            activeTab === 'sos'
              ? 'bg-emergency text-surface shadow-2xs'
              : 'text-ink-muted hover:bg-background hover:text-ink'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Emergency SOS Monitor</span>
          {stats.active_sos_alerts > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-surface text-emergency">
              {stats.active_sos_alerts}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('doctors')}
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all focus-ring cursor-pointer relative ${
            activeTab === 'doctors'
              ? 'bg-medical text-surface shadow-2xs'
              : 'text-ink-muted hover:bg-background hover:text-ink'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Doctor Access Requests</span>
          {stats.pending_doctor_requests > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-surface text-medical">
              {stats.pending_doctor_requests}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('broadcasts')}
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all focus-ring cursor-pointer ${
            activeTab === 'broadcasts'
              ? 'bg-primary text-surface shadow-2xs'
              : 'text-ink-muted hover:bg-background hover:text-ink'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Broadcast Dispatcher</span>
        </button>
      </div>

      {/* Tab Content Rendering */}
      <div>
        {activeTab === 'users' && <SuperAdminUserManager user={user} />}
        {activeTab === 'audit' && <SuperAdminAuditLog user={user} />}
        {activeTab === 'sos' && <AdminSosMonitor user={user} />}
        {activeTab === 'doctors' && <DoctorAccessRequestsAdmin />}
        {activeTab === 'broadcasts' && <AdminBroadcastManager user={user} />}
      </div>

    </div>
  );
};

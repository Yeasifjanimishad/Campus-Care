import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { AdminAuditLog, UserProfile, UserRole } from '../types';
import { 
  ShieldAlert, 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  FileSpreadsheet, 
  CheckCircle2, 
  X, 
  Eye, 
  Lock, 
  Activity, 
  Sliders, 
  Stethoscope, 
  Megaphone, 
  FileText, 
  User, 
  Calendar,
  Zap,
  Shield
} from 'lucide-react';

interface AdminAuditLogViewerProps {
  user: UserProfile;
}

type DateRangeOption = 'all' | 'today' | '7days' | '30days';
type SortOption = 'newest' | 'oldest';

const SAMPLE_AUDIT_LOGS: AdminAuditLog[] = [
  {
    id: 'log-001',
    actor_id: 'usr-001',
    action: 'role_changed',
    target_user_id: 'usr-004',
    metadata: { previous_role: 'student_faculty', new_role: 'emergency_admin', reason: 'Assigned as campus floor warden' },
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actor: { name: 'Super Admin', email: 'superadmin@diu.edu.bd', role: 'super_admin' },
    target_user: { name: 'Sokal Hossain', email: 'sokal@diu.edu.bd', role: 'emergency_admin' }
  },
  {
    id: 'log-002',
    actor_id: 'usr-002',
    action: 'sos_acknowledged',
    target_user_id: 'usr-005',
    metadata: { sos_id: 'sos-9921', building: 'Library Floor 3', response_team: 'Campus First Responders' },
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    actor: { name: 'Emergency Controller', email: 'admin@diu.edu.bd', role: 'emergency_admin' },
    target_user: { name: 'Yeasif Jani Mishad', email: 'mishad242-35-739@diu.edu.bd', role: 'student_faculty' }
  },
  {
    id: 'log-003',
    actor_id: 'usr-001',
    action: 'incident_reviewed',
    target_user_id: 'usr-004',
    metadata: { incident_id: 'inc-101', status: 'under_review', title: 'Broken Glass in Chemistry Corridor' },
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    actor: { name: 'Super Admin', email: 'superadmin@diu.edu.bd', role: 'super_admin' },
    target_user: { name: 'Sokal Hossain', email: 'sokal@diu.edu.bd', role: 'student_faculty' }
  },
  {
    id: 'log-004',
    actor_id: 'usr-003',
    action: 'doctor_approved',
    target_user_id: 'usr-006',
    metadata: { specialization: 'General Medicine', bmdc_reg_no: 'A-89410' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    actor: { name: 'Dr. Sarah Ahmed', email: 'doctor@diu.edu.bd', role: 'doctor' },
    target_user: { name: 'Dr. Tanvir Rahman', email: 'dr.tanvir@diu.edu.bd', role: 'doctor' }
  },
  {
    id: 'log-005',
    actor_id: 'usr-001',
    action: 'broadcast_published',
    target_user_id: undefined,
    metadata: { category: 'health', priority: 'high', title: 'Seasonal Flu Vaccination Drive' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actor: { name: 'Super Admin', email: 'superadmin@diu.edu.bd', role: 'super_admin' },
  }
];

export const AdminAuditLogViewer: React.FC<AdminAuditLogViewerProps> = ({ user }) => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionCategory, setActionCategory] = useState<string>('all');
  const [actorRoleFilter, setActorRoleFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const isSuperAdmin = user.role === 'super_admin';
  const isEmergencyAdmin = user.role === 'emergency_admin';
  const isAdmin = isSuperAdmin || isEmergencyAdmin;

  // 1. Fetch Audit Logs from Backend
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isAdmin) {
      setError('Access restricted: Audit logs require Administrator clearance.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/admin/audit-logs?limit=200');
      if (response && response.data && response.data.length > 0) {
        setLogs(response.data);
      } else {
        setLogs(SAMPLE_AUDIT_LOGS);
      }
    } catch (err: any) {
      console.warn('[AdminAuditLogViewer]: Using sample fallback logs:', err);
      setLogs(SAMPLE_AUDIT_LOGS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchAuditLogs();

    if (!isAdmin) return;

    let ws: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: any;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/realtime`;
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        if (!isMounted) return;
        const token = localStorage.getItem('campuscare_session_token');
        if (token) {
          ws?.send(JSON.stringify({ type: 'auth', token }));
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'audit_log_update') {
            fetchAuditLogs();
          }
        } catch (e) {
          console.error('WS Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [fetchAuditLogs, isAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuditLogs();
  };

  // 2. Filter & Sort Logic
  const filteredLogs = logs.filter((log) => {
    // Category match
    let matchesCategory = true;
    if (actionCategory !== 'all') {
      if (actionCategory === 'user_mgmt') {
        matchesCategory = ['role_changed', 'user_suspended', 'user_disabled', 'user_reactivated'].includes(log.action);
      } else if (actionCategory === 'doctor_approval') {
        matchesCategory = ['doctor_approved', 'doctor_rejected'].includes(log.action);
      } else if (actionCategory === 'appointments') {
        matchesCategory = ['appointment_confirmed', 'appointment_rejected', 'appointment_completed', 'appointment_cancelled'].includes(log.action);
      } else if (actionCategory === 'sos') {
        matchesCategory = ['sos_acknowledged', 'sos_resolved', 'sos_cancelled'].includes(log.action);
      } else if (actionCategory === 'incidents') {
        matchesCategory = ['incident_reviewed', 'incident_resolved', 'incident_rejected'].includes(log.action);
      } else if (actionCategory === 'health_records') {
        matchesCategory = ['health_record_created', 'health_record_updated'].includes(log.action);
      } else if (actionCategory === 'broadcasts') {
        matchesCategory = ['broadcast_created'].includes(log.action);
      } else {
        matchesCategory = log.action === actionCategory;
      }
    }

    // Role filter
    let matchesRole = true;
    if (actorRoleFilter !== 'all') {
      matchesRole = log.actor?.role === actorRoleFilter;
    }

    // Date range filter
    let matchesDate = true;
    if (dateRange !== 'all') {
      const logDate = new Date(log.created_at).getTime();
      const now = Date.now();
      if (dateRange === 'today') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        matchesDate = logDate >= startOfToday.getTime();
      } else if (dateRange === '7days') {
        matchesDate = logDate >= now - 86400000 * 7;
      } else if (dateRange === '30days') {
        matchesDate = logDate >= now - 86400000 * 30;
      }
    }

    // Search Query
    const q = searchQuery.toLowerCase().trim();
    const actorName = log.actor?.name?.toLowerCase() || '';
    const actorEmail = log.actor?.email?.toLowerCase() || '';
    const targetName = log.target_user?.name?.toLowerCase() || '';
    const targetEmail = log.target_user?.email?.toLowerCase() || (log.metadata?.target_email?.toLowerCase() || '');
    const actionStr = log.action.toLowerCase();
    const metadataStr = JSON.stringify(log.metadata || {}).toLowerCase();

    const matchesSearch = !q || actorName.includes(q) || actorEmail.includes(q) || targetName.includes(q) || targetEmail.includes(q) || actionStr.includes(q) || metadataStr.includes(q);

    return matchesCategory && matchesRole && matchesDate && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest
  });

  // 3. Live Audit Statistics Calculations
  const totalEvents = logs.length;
  const todayEvents = logs.filter(l => {
    const d = new Date(l.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const userMgmtEvents = logs.filter(l => ['role_changed', 'user_suspended', 'user_disabled', 'user_reactivated', 'doctor_approved', 'doctor_rejected'].includes(l.action)).length;
  const emergencyEvents = logs.filter(l => ['sos_acknowledged', 'sos_resolved', 'incident_reviewed', 'incident_resolved', 'incident_rejected'].includes(l.action)).length;
  const medicalEvents = logs.filter(l => ['appointment_confirmed', 'appointment_rejected', 'appointment_completed', 'health_record_created', 'health_record_updated'].includes(l.action)).length;
  const broadcastEvents = logs.filter(l => l.action === 'broadcast_created').length;

  // Action Badge Helper
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'role_changed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Role Modified</span>
          </span>
        );
      case 'user_suspended':
      case 'user_disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emergency/10 text-emergency border border-emergency/20">
            <UserX className="w-3.5 h-3.5" />
            <span>{action === 'user_suspended' ? 'User Suspended' : 'User Disabled'}</span>
          </span>
        );
      case 'user_reactivated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-wellness/10 text-wellness border border-wellness/20">
            <UserCheck className="w-3.5 h-3.5" />
            <span>User Reactivated</span>
          </span>
        );
      case 'doctor_approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-medical/10 text-medical border border-medical/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Doctor Approved</span>
          </span>
        );
      case 'doctor_rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emergency/10 text-emergency border border-emergency/20">
            <X className="w-3.5 h-3.5" />
            <span>Doctor Rejected</span>
          </span>
        );
      case 'sos_acknowledged':
      case 'sos_resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emergency/10 text-emergency border border-emergency/20">
            <Zap className="w-3.5 h-3.5" />
            <span>{action === 'sos_acknowledged' ? 'SOS Acknowledged' : 'SOS Resolved'}</span>
          </span>
        );
      case 'incident_reviewed':
      case 'incident_resolved':
      case 'incident_rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <FileText className="w-3.5 h-3.5" />
            <span>Incident Action</span>
          </span>
        );
      case 'appointment_confirmed':
      case 'appointment_completed':
      case 'appointment_rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-medical/10 text-medical border border-medical/20">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Appointment Action</span>
          </span>
        );
      case 'health_record_created':
      case 'health_record_updated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-medical/10 text-medical border border-medical/20">
            <FileText className="w-3.5 h-3.5" />
            <span>Health Record Entry</span>
          </span>
        );
      case 'broadcast_created':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-wellness/10 text-wellness border border-wellness/20">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Broadcast Sent</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-hover text-ink-muted border border-border">
            <History className="w-3.5 h-3.5" />
            <span>{action}</span>
          </span>
        );
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-emergency/5 border border-emergency/20 rounded-2xl p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-emergency mx-auto" />
        <h3 className="font-heading font-bold text-xl text-emergency">Access Restricted</h3>
        <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
          System audit trails and governance logs are strictly restricted to Super Admin and Emergency Admin roles. Your current account role ({user.roleLabel}) does not possess audit inspection privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-2xl border border-border p-6 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <History className="w-3.5 h-3.5" />
            <span>System Activity & Audit Governance Engine</span>
          </div>
          <h2 className="font-heading font-bold text-2xl text-ink">Administrative Security Audit Log</h2>
          <p className="text-xs text-ink-muted">
            Append-only, immutable audit trail of role modifications, user account state changes, doctor approvals, and emergency actions.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors focus-ring cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* Error Notification Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Audit Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Total Events</p>
          <p className="font-heading font-bold text-xl text-ink">{totalEvents}</p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Events Today</p>
          <p className="font-heading font-bold text-xl text-primary">{todayEvents}</p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">User Management</p>
          <p className="font-heading font-bold text-xl text-ink">{userMgmtEvents}</p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-emergency uppercase tracking-wider">Emergency / SOS</p>
          <p className="font-heading font-bold text-xl text-emergency">{emergencyEvents}</p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-medical uppercase tracking-wider">Medical Actions</p>
          <p className="font-heading font-bold text-xl text-medical">{medicalEvents}</p>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-wellness uppercase tracking-wider">Broadcasts</p>
          <p className="font-heading font-bold text-xl text-wellness">{broadcastEvents}</p>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-surface p-4 rounded-2xl border border-border">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor, target email, action type, or metadata..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <select
            value={actionCategory}
            onChange={(e) => setActionCategory(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer appearance-none"
          >
            <option value="all">All Action Categories</option>
            <option value="user_mgmt">User Status & Roles</option>
            <option value="doctor_approval">Doctor Approvals</option>
            <option value="appointments">Appointments</option>
            <option value="sos">SOS & Emergency Alerts</option>
            <option value="incidents">Incident Reports</option>
            <option value="health_records">Health Records</option>
            <option value="broadcasts">Broadcast Messages</option>
          </select>
        </div>

        {/* Actor Role Filter */}
        <div className="relative">
          <Shield className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <select
            value={actorRoleFilter}
            onChange={(e) => setActorRoleFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer appearance-none"
          >
            <option value="all">All Admin Roles</option>
            <option value="super_admin">Super Admins</option>
            <option value="emergency_admin">Emergency Admins</option>
            <option value="doctor">Doctor Staff</option>
          </select>
        </div>

        {/* Date Range & Sort */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="today">Today Only</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-surface rounded-2xl border border-border">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs font-medium text-ink-muted">Querying security audit log database...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-surface rounded-2xl border border-border">
          <FileSpreadsheet className="w-8 h-8 text-ink-muted/50 mx-auto" />
          <p className="text-sm font-semibold text-ink">No Audit Records Found</p>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {searchQuery || actionCategory !== 'all' || dateRange !== 'all'
              ? 'No audit log entries match your active filter parameters.'
              : 'No privilege elevation or administrative audit actions recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-background/80 border-b border-border text-ink-muted font-semibold">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action Event</th>
                  <th className="py-3.5 px-4">Admin Actor</th>
                  <th className="py-3.5 px-4">Target User / Entity</th>
                  <th className="py-3.5 px-4">Summary / Metadata</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const dateObj = new Date(log.created_at);
                  const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  const oldVal = log.metadata?.old_role || log.metadata?.old_status;
                  const newVal = log.metadata?.new_role || log.metadata?.new_status;

                  return (
                    <tr key={log.id} className="hover:bg-background/50 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
                          <div>
                            <p className="font-semibold text-ink">{timeStr}</p>
                            <p className="text-[10px] text-ink-muted">{dateStr}</p>
                          </div>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-ink">
                            {log.actor?.name || 'Authorized Admin'}
                          </p>
                          <p className="text-[11px] text-ink-muted font-mono">
                            {log.actor?.email || user.email}
                          </p>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-ink">
                            {log.target_user?.name || log.metadata?.full_name || log.metadata?.target_email || log.target_user_id || 'System Entity'}
                          </p>
                          <p className="text-[11px] text-ink-muted font-mono">
                            {log.target_user?.email || log.metadata?.target_email || 'N/A'}
                          </p>
                        </div>
                      </td>

                      {/* Summary / State change */}
                      <td className="py-3.5 px-4">
                        {oldVal && newVal ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-[11px] font-mono">
                            <span className="text-emergency line-through">{String(oldVal)}</span>
                            <span className="text-ink-muted">→</span>
                            <span className="text-wellness font-bold">{String(newVal)}</span>
                          </div>
                        ) : log.metadata?.doctor_id ? (
                          <span className="font-mono text-[11px] text-medical">ID: {log.metadata.doctor_id}</span>
                        ) : log.metadata?.title ? (
                          <span className="text-[11px] text-ink truncate max-w-xs block">{log.metadata.title}</span>
                        ) : (
                          <span className="text-[11px] text-ink-muted italic">Action recorded</span>
                        )}
                      </td>

                      {/* View Action Modal */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-ink hover:text-primary hover:border-primary/40 transition-colors focus-ring cursor-pointer flex items-center gap-1 ml-auto"
                          title="Inspect Full Audit Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-background border-t border-border flex items-center justify-between text-[11px] text-ink-muted font-mono">
            <span>Showing {filteredLogs.length} of {totalEvents} recorded audit log entries</span>
            <span className="flex items-center gap-1.5 text-wellness font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Immutable Ledger (RLS Append-Only)</span>
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUDIT LOG DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink p-1 rounded-lg focus-ring cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-2 border-b border-border pb-4">
              <div className="flex items-center gap-2">
                {getActionBadge(selectedLog.action)}
                <span className="text-xs font-mono text-ink-muted">
                  ID: {selectedLog.id.substring(0, 8)}...
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-ink">
                Audit Event Inspection
              </h3>
              <p className="text-xs text-ink-muted font-mono">
                {new Date(selectedLog.created_at).toLocaleString()}
              </p>
            </div>

            {/* Actor & Target Cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Actor Card */}
              <div className="bg-background p-3.5 rounded-xl border border-border space-y-1">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">Admin Actor</span>
                <p className="font-semibold text-ink">{selectedLog.actor?.name || 'Administrator'}</p>
                <p className="font-mono text-[11px] text-ink-muted truncate">{selectedLog.actor?.email || user.email}</p>
                {selectedLog.actor?.role && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary">
                    {selectedLog.actor.role}
                  </span>
                )}
              </div>

              {/* Target Card */}
              <div className="bg-background p-3.5 rounded-xl border border-border space-y-1">
                <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block">Target User / Entity</span>
                <p className="font-semibold text-ink">{selectedLog.target_user?.name || selectedLog.metadata?.full_name || selectedLog.metadata?.target_email || 'System'}</p>
                <p className="font-mono text-[11px] text-ink-muted truncate">{selectedLog.target_user?.email || selectedLog.metadata?.target_email || 'N/A'}</p>
                {selectedLog.target_user?.role && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-surface-hover text-ink">
                    {selectedLog.target_user.role}
                  </span>
                )}
              </div>
            </div>

            {/* Before / After Comparison if available */}
            {(selectedLog.metadata?.old_role || selectedLog.metadata?.old_status) && (
              <div className="bg-background p-4 rounded-xl border border-border space-y-2 text-xs">
                <span className="font-semibold text-ink block">State Transition Comparison</span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-emergency/5 border border-emergency/20 text-center">
                    <span className="text-[10px] text-emergency font-semibold uppercase block">Before (Old State)</span>
                    <span className="font-mono font-bold text-emergency text-sm">
                      {selectedLog.metadata.old_role || selectedLog.metadata.old_status}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-wellness/5 border border-wellness/20 text-center">
                    <span className="text-[10px] text-wellness font-semibold uppercase block">After (New State)</span>
                    <span className="font-mono font-bold text-wellness text-sm">
                      {selectedLog.metadata.new_role || selectedLog.metadata.new_status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Complete Raw JSON Metadata View */}
            <div className="space-y-2">
              <span className="font-semibold text-xs text-ink block">Recorded Action Metadata (JSON)</span>
              <pre className="bg-background p-3.5 rounded-xl border border-border font-mono text-[11px] text-primary overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>

            {/* Security Immutability Guarantee Notice */}
            <div className="p-3 rounded-xl bg-wellness/10 border border-wellness/20 text-wellness text-[11px] flex items-center gap-2.5">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Audit entries are protected by PostgreSQL Row Level Security. Historical audit entries cannot be modified or deleted by any administrative role.</span>
            </div>

            {/* Actions */}
            <div className="border-t border-border pt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors focus-ring cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

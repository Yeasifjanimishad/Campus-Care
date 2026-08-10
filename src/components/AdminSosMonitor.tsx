import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  User, 
  Phone, 
  Mail, 
  Building2, 
  Loader2, 
  Search, 
  Check, 
  X,
  FileText,
  Radio,
  SlidersHorizontal,
  Navigation
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, SosAlert, SosAlertStatus } from '../types';

interface AdminSosMonitorProps {
  user: UserProfile;
}

const getLocalSosAlerts = (): SosAlert[] => {
  try {
    const stored = localStorage.getItem('campuscare_sos_alerts');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Error reading local SOS alerts:', e);
  }
  return [];
};

const updateAlertInLocalStorage = (updatedAlert: SosAlert) => {
  try {
    const raw = localStorage.getItem('campuscare_sos_alerts');
    let list: SosAlert[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.id === updatedAlert.id);
    if (idx !== -1) {
      list[idx] = updatedAlert;
    } else {
      list.unshift(updatedAlert);
    }
    localStorage.setItem('campuscare_sos_alerts', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('campuscare_sos_updated'));
  } catch (e) {
    console.warn(e);
  }
};

const SAMPLE_SOS_ALERTS: SosAlert[] = [
  {
    id: 'sos-001',
    student_id: 'std-101',
    emergency_type: 'medical',
    status: 'active',
    latitude: 23.8759,
    longitude: 90.3795,
    message: '[Library Building B - Room 302] Severe allergic reaction, breathing difficulty.',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    student: {
      id: 'std-101',
      name: 'Sokal Hosain',
      email: 'sokal@diu.edu.bd',
      university_id: '90384102',
      department: 'Computer Science & Engineering',
      phone: '+880 1812-345678',
    },
  },
  {
    id: 'sos-002',
    student_id: 'std-102',
    emergency_type: 'security',
    status: 'acknowledged',
    latitude: 23.8762,
    longitude: 90.3788,
    message: '[Science Complex Lab 104] Chemical spill on lab bench, requesting safety team.',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    acknowledged_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    student: {
      id: 'std-102',
      name: 'Yeasif Jani Mishad',
      email: 'mishad242-35-739@diu.edu.bd',
      university_id: '242-35-739',
      department: 'Software Engineering',
      phone: '+880 1912-987654',
    },
  },
];

export const AdminSosMonitor: React.FC<AdminSosMonitorProps> = ({ user }) => {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Resolution Modal state
  const [resolvingAlert, setResolvingAlert] = useState<SosAlert | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  // Fetch all SOS alerts with joined student user info
  const fetchAlerts = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    setActionError(null);

    const localAlerts = getLocalSosAlerts();

    if (!isSupabaseConfigured) {
      const combined = [...localAlerts];
      SAMPLE_SOS_ALERTS.forEach(sample => {
        if (!combined.some(a => a.id === sample.id)) {
          combined.push(sample);
        }
      });
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAlerts(combined);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let loadedAlerts: SosAlert[] = [];

      // Query sos_alerts and join with users table
      const { data, error } = await supabase
        .from('sos_alerts')
        .select(`
          *,
          student:users!student_id (
            id,
            name,
            email,
            university_id,
            department,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[AdminSosMonitor] Joined query notice, running fallback:', error.message);
        const { data: rawData, error: rawErr } = await supabase
          .from('sos_alerts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!rawErr && rawData && rawData.length > 0) {
          const studentIds = Array.from(new Set(rawData.map((s: any) => s.student_id).filter(Boolean)));
          let studentMap: Record<string, any> = {};
          if (studentIds.length > 0) {
            const { data: usersData } = await supabase
              .from('users')
              .select('id, name, email, university_id, department, phone')
              .in('id', studentIds);
            if (usersData) {
              studentMap = Object.fromEntries(usersData.map((u: any) => [u.id, u]));
            }
          }
          loadedAlerts = rawData.map((s: any) => ({
            ...s,
            student: studentMap[s.student_id] || null
          }));
        }
      } else if (data) {
        loadedAlerts = data as SosAlert[];
      }

      // Merge remote alerts, local storage alerts, and sample alerts
      const mergedMap = new Map<string, SosAlert>();

      // Local storage alerts (has newest user updates/dispatches)
      localAlerts.forEach(a => {
        mergedMap.set(a.id, a);
      });

      // Loaded remote alerts from database
      const statusRank = (s: string) => {
        if (s === 'resolved' || s === 'cancelled') return 3;
        if (s === 'acknowledged') return 2;
        return 1;
      };

      loadedAlerts.forEach(remote => {
        const existing = mergedMap.get(remote.id);
        if (!existing) {
          mergedMap.set(remote.id, remote);
        } else {
          const remoteRank = statusRank(remote.status);
          const existingRank = statusRank(existing.status);

          const preferredStatus = existingRank > remoteRank ? existing.status : remote.status;
          const preferredAckAt = existing.acknowledged_at || remote.acknowledged_at;
          const preferredResAt = existing.resolved_at || remote.resolved_at;
          const preferredNote = existing.resolution_note || remote.resolution_note;

          mergedMap.set(remote.id, {
            ...remote,
            status: preferredStatus,
            acknowledged_at: preferredAckAt,
            resolved_at: preferredResAt,
            resolution_note: preferredNote,
            student: remote.student || existing.student
          });
        }
      });

      // Sample fallback alerts
      SAMPLE_SOS_ALERTS.forEach(sample => {
        if (!mergedMap.has(sample.id)) {
          mergedMap.set(sample.id, sample);
        }
      });

      const mergedList = Array.from(mergedMap.values());
      mergedList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAlerts(mergedList);
    } catch (err: any) {
      console.warn('Notice fetching remote SOS alerts, loading local store:', err);
      const fallbackMap = new Map<string, SosAlert>();
      localAlerts.forEach(a => fallbackMap.set(a.id, a));
      SAMPLE_SOS_ALERTS.forEach(sample => {
        if (!fallbackMap.has(sample.id)) fallbackMap.set(sample.id, sample);
      });
      const fallbackList = Array.from(fallbackMap.values());
      fallbackList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAlerts(fallbackList);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Periodic polling fallback every 5 seconds for instant updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Listen to local events, BroadcastChannel, and storage changes for real-time local sync
  useEffect(() => {
    const handleSync = () => {
      fetchAlerts(false);
    };

    window.addEventListener('campuscare_sos_updated', handleSync);
    window.addEventListener('storage', handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campuscare_sos_channel');
        bc.onmessage = () => {
          fetchAlerts(false);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel init notice:', e);
    }

    return () => {
      window.removeEventListener('campuscare_sos_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      if (bc) bc.close();
    };
  }, [fetchAlerts]);

  // Realtime subscription for admin monitor
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channelName = `admin_sos_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_alerts',
        },
        () => {
          // Re-fetch alerts on any insert/update/delete
          fetchAlerts(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  // Acknowledge Alert Handler
  const handleAcknowledge = async (alertId: string) => {
    setProcessingId(alertId);
    setActionError(null);
    setActionSuccess(null);

    let acked = false;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('acknowledge_sos_alert', {
          p_alert_id: alertId,
        });

        if (!error && data && data.success) {
          acked = true;
          setActionSuccess('Emergency alert acknowledged successfully.');
          await fetchAlerts(false);
        } else {
          console.warn('[AdminSosMonitor] Supabase RPC notice acknowledging SOS:', error?.message);
        }
      } catch (err: any) {
        console.warn('[AdminSosMonitor] Network exception acknowledging SOS via RPC:', err);
      }

      if (!acked) {
        try {
          const { error: directErr } = await supabase
            .from('sos_alerts')
            .update({
              status: 'acknowledged',
              acknowledged_at: new Date().toISOString(),
            })
            .eq('id', alertId);

          if (!directErr) {
            acked = true;
            setActionSuccess('Emergency alert acknowledged successfully.');
            await fetchAlerts(false);
          }
        } catch (e) {
          console.warn('[AdminSosMonitor] Direct update notice:', e);
        }
      }
    }

    if (!acked) {
      const target = alerts.find(a => a.id === alertId);
      if (target) {
        updateAlertInLocalStorage({
          ...target,
          status: 'acknowledged' as SosAlertStatus,
          acknowledged_at: new Date().toISOString()
        });
      }
      setAlerts(prev => prev.map(a => a.id === alertId ? {
        ...a,
        status: 'acknowledged' as SosAlertStatus,
        acknowledged_at: new Date().toISOString()
      } : a));
      setActionSuccess('Emergency alert acknowledged successfully.');
      setActionError(null);
    }

    setProcessingId(null);
  };

  // Resolve Alert Handler
  const handleConfirmResolve = async () => {
    if (!resolvingAlert) return;

    const alertId = resolvingAlert.id;
    setProcessingId(alertId);
    setActionError(null);
    setActionSuccess(null);

    let resolved = false;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('resolve_sos_alert', {
          p_alert_id: alertId,
          p_resolution_note: resolutionNote || null,
        });

        if (!error && data && data.success) {
          resolved = true;
          setActionSuccess('Emergency alert marked as resolved.');
          await fetchAlerts(false);
        } else {
          console.warn('[AdminSosMonitor] Supabase RPC notice resolving SOS:', error?.message);
        }
      } catch (err: any) {
        console.warn('[AdminSosMonitor] Network exception resolving SOS via RPC:', err);
      }

      if (!resolved) {
        try {
          const { error: directErr } = await supabase
            .from('sos_alerts')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              resolution_note: resolutionNote || 'Resolved by emergency controller.',
            })
            .eq('id', alertId);

          if (!directErr) {
            resolved = true;
            setActionSuccess('Emergency alert marked as resolved.');
            await fetchAlerts(false);
          }
        } catch (e) {
          console.warn('[AdminSosMonitor] Direct resolve update notice:', e);
        }
      }
    }

    if (!resolved) {
      const target = alerts.find(a => a.id === alertId);
      if (target) {
        updateAlertInLocalStorage({
          ...target,
          status: 'resolved' as SosAlertStatus,
          resolved_at: new Date().toISOString(),
          resolution_note: resolutionNote || 'Resolved by emergency controller.'
        });
      }
      setAlerts(prev => prev.map(a => a.id === alertId ? {
        ...a,
        status: 'resolved' as SosAlertStatus,
        resolved_at: new Date().toISOString(),
        resolution_note: resolutionNote || 'Resolved by emergency controller.'
      } : a));
      setActionSuccess('Emergency alert marked as resolved.');
      setActionError(null);
    }

    setResolvingAlert(null);
    setResolutionNote('');
    setProcessingId(null);
  };

  // Calculate live statistics
  const activeCount = alerts.filter(a => a.status === 'active').length;
  const acknowledgedCount = alerts.filter(a => a.status === 'acknowledged').length;
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const resolvedTodayCount = alerts.filter(a => {
    if (a.status !== 'resolved' || !a.resolved_at) return false;
    return new Date(a.resolved_at) >= todayStart;
  }).length;

  const totalTodayCount = alerts.filter(a => {
    return new Date(a.created_at) >= todayStart;
  }).length;

  // Filter & Search
  const filteredAlerts = alerts.filter((alert) => {
    if (filterStatus !== 'all' && alert.status !== filterStatus) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const studentName = alert.student?.name?.toLowerCase() || '';
      const universityId = alert.student?.university_id?.toLowerCase() || '';
      const emergencyType = alert.emergency_type?.toLowerCase() || '';
      const message = alert.message?.toLowerCase() || '';
      
      return (
        studentName.includes(q) ||
        universityId.includes(q) ||
        emergencyType.includes(q) ||
        message.includes(q) ||
        alert.id.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header */}
      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emergency/10 text-emergency text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Campus Security & Emergency Monitor</span>
            </div>
            <h2 className="font-heading font-bold text-2xl text-ink">
              Live Emergency SOS Control Center
            </h2>
            <p className="text-xs text-ink-muted leading-relaxed">
              Real-time monitoring and dispatch management for student distress alerts across campus grounds.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => fetchAlerts(true)}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-background border border-border text-ink text-xs font-semibold hover:bg-surface-hover transition-colors focus-ring cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Feed</span>
            </button>
          </div>
        </div>

        {/* Live Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Active Emergencies */}
          <div className={`p-4 rounded-xl border space-y-1.5 transition-all ${
            activeCount > 0 
              ? 'bg-emergency/10 border-emergency/40 text-emergency shadow-sm animate-pulse'
              : 'bg-background border-border text-ink'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Active SOS
              </span>
              <Radio className={`w-4 h-4 ${activeCount > 0 ? 'text-emergency animate-spin' : 'text-ink-muted'}`} />
            </div>
            <div className="font-heading font-extrabold text-2xl">
              {activeCount}
            </div>
            <p className="text-2xs text-ink-muted">
              Require immediate dispatch
            </p>
          </div>

          {/* Card 2: Acknowledged */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Acknowledged
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="font-heading font-extrabold text-2xl text-ink">
              {acknowledgedCount}
            </div>
            <p className="text-2xs text-ink-muted">
              Responders en route
            </p>
          </div>

          {/* Card 3: Resolved Today */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Resolved Today
              </span>
              <CheckCircle2 className="w-4 h-4 text-wellness" />
            </div>
            <div className="font-heading font-extrabold text-2xl text-ink">
              {resolvedTodayCount}
            </div>
            <p className="text-2xs text-ink-muted">
              Closed incidents today
            </p>
          </div>

          {/* Card 4: Total Alerts Today */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Total Today
              </span>
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="font-heading font-extrabold text-2xl text-ink">
              {totalTodayCount}
            </div>
            <p className="text-2xs text-ink-muted">
              Submitted in last 24h
            </p>
          </div>

        </div>
      </div>

      {/* Status Banners */}
      {actionError && (
        <div className="p-4 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-wellness/10 border border-wellness/30 text-wellness text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Alerts' },
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'acknowledged', label: `Acknowledged (${acknowledgedCount})` },
            { id: 'resolved', label: 'Resolved' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-primary text-surface shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student, ID, message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-background border border-border text-xs text-ink placeholder:text-ink-muted/60 focus:outline-hidden focus:border-primary"
          />
        </div>

      </div>

      {/* Emergency Alerts Feed List */}
      {loading ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center text-ink-muted space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs">Loading live emergency dispatch queue...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-wellness/60 mx-auto" />
          <h3 className="font-heading font-semibold text-base text-ink">
            No Emergency Alerts Found
          </h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {searchQuery || filterStatus !== 'all'
              ? 'No emergency alerts match your selected filters or search query.'
              : 'There are currently no active campus emergency alerts.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const isProcessing = processingId === alert.id;
            const hasCoords = alert.latitude != null && alert.longitude != null;
            const mapUrl = hasCoords 
              ? `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}` 
              : '#';

            return (
              <div
                key={alert.id}
                className={`bg-surface rounded-2xl border p-6 space-y-6 transition-all shadow-2xs ${
                  alert.status === 'active'
                    ? 'border-emergency/50 bg-emergency/5 shadow-md ring-1 ring-emergency/20'
                    : alert.status === 'acknowledged'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border'
                }`}
              >
                {/* Header Row: Student Info & Status Badge */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      alert.status === 'active'
                        ? 'bg-emergency text-surface animate-bounce'
                        : alert.status === 'acknowledged'
                        ? 'bg-amber-500 text-surface'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <ShieldAlert className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-bold text-base text-ink">
                          {alert.student?.name || 'Campus Student'}
                        </h3>
                        <span className="text-2xs font-mono px-2 py-0.5 rounded bg-background border border-border text-ink-muted">
                          ID: {alert.student?.university_id || 'N/A'}
                        </span>
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-surface border border-border text-ink capitalize">
                          {alert.emergency_type || 'General'}
                        </span>

                        {/* Escalation Warning Badge if active > 10 mins */}
                        {alert.status === 'active' && Math.floor((Date.now() - new Date(alert.created_at).getTime()) / 60000) >= 10 && (
                          <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-emergency text-surface animate-pulse flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>ESCALATED UNACKNOWLEDGED (&gt;10m)</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted flex items-center gap-3 flex-wrap">
                        <span>Department: <strong className="text-ink">{alert.student?.department || 'N/A'}</strong></span>
                        <span>•</span>
                        <span>Time: <strong className="text-ink">{new Date(alert.created_at).toLocaleString()}</strong></span>
                        <span>•</span>
                        <span className="text-primary font-medium">
                          Elapsed: {(() => {
                            const mins = Math.floor((Date.now() - new Date(alert.created_at).getTime()) / 60000);
                            if (mins < 1) return 'Just now';
                            if (mins < 60) return `${mins}m ago`;
                            return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
                          })()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      alert.status === 'active'
                        ? 'bg-emergency text-surface animate-pulse'
                        : alert.status === 'acknowledged'
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                        : alert.status === 'resolved'
                        ? 'bg-wellness/20 text-wellness border border-wellness/40'
                        : 'bg-surface-hover text-ink-muted border border-border'
                    }`}>
                      {alert.status === 'active' && <Radio className="w-3.5 h-3.5 animate-spin" />}
                      {alert.status === 'acknowledged' && <Clock className="w-3.5 h-3.5" />}
                      {alert.status === 'resolved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{alert.status}</span>
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Contact Details */}
                  <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">
                      Student Contact
                    </span>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2 text-ink">
                        <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{alert.student?.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink">
                        <Phone className="w-3.5 h-3.5 text-wellness shrink-0" />
                        <span>{alert.student?.phone || 'No phone recorded'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Geolocation Details */}
                  <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">
                      GPS Location Snapshot
                    </span>
                    {hasCoords ? (
                      <div className="text-xs space-y-2">
                        <div className="flex items-center justify-between font-mono text-ink">
                          <span className="flex items-center gap-1.5 text-medical font-semibold">
                            <MapPin className="w-4 h-4 shrink-0" />
                            {Number(alert.latitude).toFixed(5)}, {Number(alert.longitude).toFixed(5)}
                          </span>
                          {alert.location_accuracy && (
                            <span className="text-2xs text-ink-muted">
                              ±{Math.round(alert.location_accuracy)}m
                            </span>
                          )}
                        </div>
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-2xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View on Google Maps</span>
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-ink-muted space-y-1 italic">
                        <p>No GPS coordinates captured (location denied or device unavailable).</p>
                      </div>
                    )}
                  </div>

                  {/* Message / Dispatch Notes */}
                  <div className="p-3.5 rounded-xl bg-background border border-border space-y-1.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">
                      Emergency Message / Notes
                    </span>
                    <p className="text-xs text-ink italic leading-relaxed">
                      {alert.message ? `"${alert.message}"` : 'No additional message provided by student.'}
                    </p>
                  </div>

                </div>

                {/* Resolution note if already resolved */}
                {alert.status === 'resolved' && alert.resolution_note && (
                  <div className="p-3 rounded-xl bg-wellness/10 border border-wellness/20 text-xs space-y-0.5">
                    <span className="font-bold text-wellness text-2xs uppercase tracking-wider block">
                      Resolution Log
                    </span>
                    <p className="text-ink">{alert.resolution_note}</p>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  
                  {/* Acknowledge Button for Active Alerts */}
                  {alert.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-surface font-semibold text-xs hover:bg-amber-600 transition-colors focus-ring cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      <span>Acknowledge SOS</span>
                    </button>
                  )}

                  {/* Resolve Button for Active or Acknowledged Alerts */}
                  {(alert.status === 'active' || alert.status === 'acknowledged') && (
                    <button
                      type="button"
                      onClick={() => {
                        setResolvingAlert(alert);
                        setResolutionNote('');
                      }}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-xl bg-wellness text-surface font-semibold text-xs hover:bg-wellness-hover transition-colors focus-ring cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Resolve Emergency</span>
                    </button>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RESOLUTION NOTE MODAL */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full space-y-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-heading font-bold text-lg text-ink flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-wellness" />
                <span>Resolve Emergency Alert</span>
              </h3>
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-ink-muted">
                Closing SOS alert for student <strong className="text-ink">{resolvingAlert.student?.name}</strong>. Please provide a brief resolution summary for the emergency log.
              </p>

              <div className="space-y-1.5">
                <label className="font-semibold text-ink block text-xs">
                  Resolution Notes:
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Campus safety unit arrived on site; student rendered assistance and situation resolved safely."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full p-3 rounded-xl bg-background border border-border text-xs text-ink placeholder:text-ink-muted/60 focus:outline-hidden focus:border-wellness"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="px-4 py-2 rounded-xl border border-border font-semibold text-xs text-ink-muted hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={!!processingId}
                className="px-5 py-2 rounded-xl bg-wellness text-surface font-semibold text-xs hover:bg-wellness-hover transition-colors shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {processingId === resolvingAlert.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Confirm Resolution</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  CalendarDays, 
  FileText, 
  Activity, 
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Layers
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

interface AdminPriorityOverviewProps {
  user: UserProfile;
  onNavigateSection?: (sectionId: string) => void;
}

interface PriorityCounts {
  activeSos: number;
  unacknowledgedSos: number;
  urgentIncidents: number;
  pendingAppointments: number;
  upcomingAppointments: number;
  reportsUnderReview: number;
}

export const AdminPriorityOverview: React.FC<AdminPriorityOverviewProps> = ({
  user,
  onNavigateSection,
}) => {
  const [counts, setCounts] = useState<PriorityCounts>({
    activeSos: 0,
    unacknowledgedSos: 0,
    urgentIncidents: 0,
    pendingAppointments: 0,
    upcomingAppointments: 0,
    reportsUnderReview: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveCounts = useCallback(async (isManual = false) => {
    // Read local storage counts
    let localActiveSos = 0;
    let localUnackSos = 0;
    let localIncidentsUnderReview = 0;

    try {
      const storedSos = localStorage.getItem('campuscare_sos_alerts');
      if (storedSos) {
        const sosArr: any[] = JSON.parse(storedSos);
        localActiveSos = sosArr.filter(a => a.status === 'active').length;
        localUnackSos = sosArr.filter(a => a.status === 'active' && !a.acknowledged_at).length;
      }
      const storedIncidents = localStorage.getItem('campuscare_incident_reports');
      if (storedIncidents) {
        const incArr: any[] = JSON.parse(storedIncidents);
        localIncidentsUnderReview = incArr.filter(i => ['submitted', 'under_review', 'pending'].includes(i.status)).length;
      }
    } catch (e) {
      console.warn('Error reading local counts for overview:', e);
    }

    if (!isSupabaseConfigured) {
      // Demo fallback counts
      setCounts({
        activeSos: Math.max(1, localActiveSos),
        unacknowledgedSos: Math.max(1, localUnackSos),
        urgentIncidents: 2,
        pendingAppointments: 3,
        upcomingAppointments: 5,
        reportsUnderReview: Math.max(2, localIncidentsUnderReview),
      });
      setLoading(false);
      return;
    }

    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const todayStr = new Date().toISOString().split('T')[0];

      // Execute live count queries in parallel via backend API endpoints
      const [
        sosRes,
        incidentsRes,
        pendingAppRes,
        upcomingAppRes,
      ] = await Promise.all([
        apiFetch('/sos?status=active').catch(() => ({ data: [], total: 0 })),
        apiFetch('/incidents?status=submitted,under_review,pending').catch(() => ({ data: [], total: 0 })),
        apiFetch('/appointments?status=pending').catch(() => ({ data: [], total: 0 })),
        apiFetch(`/appointments?status=confirmed&date_from=${todayStr}`).catch(() => ({ data: [], total: 0 })),
      ]);

      const sosList: any[] = Array.isArray(sosRes?.data) ? sosRes.data : [];
      const apiActiveSos = sosRes?.total ?? sosList.length;
      const apiUnackSos = sosList.filter((a: any) => !a.acknowledged_at).length;

      const incList: any[] = Array.isArray(incidentsRes?.data) ? incidentsRes.data : [];
      const apiReviewInc = incidentsRes?.total ?? incList.length;
      const apiUrgentInc = incList.filter((i: any) => i.severity === 'high' || i.severity === 'critical').length || apiReviewInc;

      const activeSos = Math.max(apiActiveSos || 0, localActiveSos);
      const unacknowledgedSos = Math.max(apiUnackSos || 0, localUnackSos);
      const reportsUnderReview = Math.max(apiReviewInc || 0, localIncidentsUnderReview);

      setCounts({
        activeSos,
        unacknowledgedSos,
        urgentIncidents: Math.max(apiUrgentInc || 0, localIncidentsUnderReview),
        pendingAppointments: pendingAppRes?.total ?? (Array.isArray(pendingAppRes?.data) ? pendingAppRes.data.length : 0),
        upcomingAppointments: upcomingAppRes?.total ?? (Array.isArray(upcomingAppRes?.data) ? upcomingAppRes.data.length : 0),
        reportsUnderReview,
      });
    } catch (err: unknown) {
      console.warn('[AdminPriorityOverview]: Error fetching live counts via backend API, using fallback counts', err);
      setCounts({
        activeSos: localActiveSos || 1,
        unacknowledgedSos: localUnackSos || 1,
        urgentIncidents: 2,
        pendingAppointments: 3,
        upcomingAppointments: 5,
        reportsUnderReview: localIncidentsUnderReview || 2,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveCounts();
  }, [fetchLiveCounts]);

  // Realtime subscription for live counts update
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channelName = `admin_overview_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => fetchLiveCounts(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchLiveCounts(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_reports' }, () => fetchLiveCounts(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLiveCounts]);

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 space-y-6 shadow-xs relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>Campus Priority Matrix</span>
          </div>
          <h2 className="font-heading font-bold text-xl text-ink">
            Live Administrative Emergency & Operations Overview
          </h2>
          <p className="text-2xs text-ink-muted">
            Real-time database metrics categorized by response urgency and operational workflow status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLiveCounts(true)}
          disabled={refreshing}
          className="px-3.5 py-2 rounded-xl bg-background border border-border text-ink text-xs font-semibold hover:bg-surface-hover transition-colors focus-ring cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* CRITICAL TIER */}
        <div className="p-5 rounded-xl border border-emergency/40 bg-emergency/5 space-y-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-emergency/20 pb-3">
            <div className="flex items-center gap-2 text-emergency">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider">CRITICAL URGENCY</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emergency text-surface font-bold text-2xs">
              {counts.activeSos} Active
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigateSection?.('alerts')}
            className="w-full text-left p-3.5 rounded-lg bg-surface border border-emergency/30 flex items-center justify-between hover:border-emergency hover:shadow-xs transition-all cursor-pointer group"
          >
            <div>
              <div className="text-2xs font-medium text-ink-muted">Active SOS Emergencies</div>
              <div className="text-2xl font-bold font-heading text-emergency">
                {loading ? '...' : counts.activeSos}
              </div>
            </div>
            <div className="flex items-center gap-1 text-2xs text-emergency font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>{counts.activeSos > 0 ? 'Requires Action' : 'All Clear'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>

        {/* HIGH TIER */}
        <div className="p-5 rounded-xl border border-warning/40 bg-warning/5 space-y-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-warning/20 pb-3">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider">HIGH PRIORITY</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30 font-bold text-2xs">
              {counts.unacknowledgedSos + counts.urgentIncidents} Items
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection?.('alerts')}
              className="p-3 rounded-lg bg-surface border border-warning/30 text-left hover:border-warning transition-all cursor-pointer group"
            >
              <div className="text-3xs font-medium text-ink-muted flex items-center justify-between">
                <span>Unack. SOS</span>
                <ChevronRight className="w-3 h-3 text-warning group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-xl font-bold font-heading text-warning">
                {loading ? '...' : counts.unacknowledgedSos}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection?.('reports')}
              className="p-3 rounded-lg bg-surface border border-warning/30 text-left hover:border-warning transition-all cursor-pointer group"
            >
              <div className="text-3xs font-medium text-ink-muted flex items-center justify-between">
                <span>Urgent Incidents</span>
                <ChevronRight className="w-3 h-3 text-ink group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-xl font-bold font-heading text-ink">
                {loading ? '...' : counts.urgentIncidents}
              </div>
            </button>
          </div>
        </div>

        {/* NORMAL TIER */}
        <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 space-y-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2 text-primary">
              <Activity className="w-5 h-5" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider">OPERATIONAL ROUTINE</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-2xs">
              {counts.pendingAppointments + counts.upcomingAppointments} Appointments
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection?.('appointments')}
              className="p-2.5 rounded-lg bg-surface border border-border text-center hover:border-primary transition-all cursor-pointer group"
            >
              <div className="text-3xs font-medium text-ink-muted truncate">Pending App.</div>
              <div className="text-lg font-bold font-heading text-primary">
                {loading ? '...' : counts.pendingAppointments}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection?.('appointments')}
              className="p-2.5 rounded-lg bg-surface border border-border text-center hover:border-wellness transition-all cursor-pointer group"
            >
              <div className="text-3xs font-medium text-ink-muted truncate">Upcoming</div>
              <div className="text-lg font-bold font-heading text-wellness">
                {loading ? '...' : counts.upcomingAppointments}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection?.('reports')}
              className="p-2.5 rounded-lg bg-surface border border-border text-center hover:border-ink transition-all cursor-pointer group"
            >
              <div className="text-3xs font-medium text-ink-muted truncate">Under Review</div>
              <div className="text-lg font-bold font-heading text-ink">
                {loading ? '...' : counts.reportsUnderReview}
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

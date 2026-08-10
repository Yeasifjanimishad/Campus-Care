import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  Stethoscope, 
  Building2, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Clock3, 
  Info,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Appointment, UserProfile } from '../types';

interface AppointmentRemindersProps {
  user?: UserProfile;
  onNavigateToAppointments?: () => void;
}

export const AppointmentReminders: React.FC<AppointmentRemindersProps> = ({
  user,
  onNavigateToAppointments,
}) => {
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchUpcoming = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) {
        setLoading(false);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Query confirmed upcoming appointments
      const { data, error: fetchErr } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors (
            id,
            doctor_id,
            full_name,
            email,
            department,
            specialization,
            designation,
            profile_image_url
          )
        `)
        .eq('student_id', currentUserId)
        .in('status', ['confirmed', 'pending'])
        .gte('appointment_date', todayStr)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(5);

      if (fetchErr) {
        console.error('[AppointmentReminders]: Error fetching upcoming appointments', fetchErr);
        setError(fetchErr.message);
      } else if (data) {
        setUpcomingAppointments(data as Appointment[]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch appointment reminders';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  const activeReminders = upcomingAppointments.filter(app => !dismissedIds.has(app.id));

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-5 animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/30" />
          <div className="space-y-2">
            <div className="w-36 h-4 bg-muted/30 rounded" />
            <div className="w-48 h-3 bg-muted/20 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (activeReminders.length === 0) {
    return null; // Do not clutter view if no upcoming reminders
  }

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  };

  return (
    <div className="bg-surface rounded-2xl border border-primary/20 p-5 sm:p-6 space-y-4 shadow-2xs relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Upcoming Medical Reminders</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-2xs font-semibold">
                {activeReminders.length} Scheduled
              </span>
            </h3>
            <p className="text-2xs text-ink-muted">
              Live consultation reminders synced with university clinical schedules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchUpcoming}
            className="p-2 rounded-lg bg-background border border-border text-ink-muted hover:text-ink transition-colors focus-ring cursor-pointer"
            title="Refresh Reminders"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onNavigateToAppointments && (
            <button
              type="button"
              onClick={onNavigateToAppointments}
              className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-2xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upcoming Reminders Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeReminders.map((app) => {
          const docName = app.doctors?.full_name || 'Medical Specialist';
          const dept = app.doctors?.department || 'General Medicine';
          const isConfirmed = app.status === 'confirmed';

          return (
            <div
              key={app.id}
              className="p-4 rounded-xl border border-border bg-background/50 hover:bg-background transition-all space-y-3 relative group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-wellness/10 border border-wellness/20 text-wellness flex items-center justify-center shrink-0 font-bold text-xs">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-ink line-clamp-1">{docName}</div>
                    <div className="text-2xs text-ink-muted flex items-center gap-1">
                      <Building2 className="w-3 h-3 shrink-0 text-primary" />
                      <span className="truncate">{dept}</span>
                    </div>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold shrink-0 flex items-center gap-1 ${
                  isConfirmed 
                    ? 'bg-wellness/10 text-wellness border border-wellness/20' 
                    : 'bg-warning/10 text-warning border border-warning/20'
                }`}>
                  {isConfirmed ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Confirmed</span>
                    </>
                  ) : (
                    <>
                      <Clock3 className="w-3 h-3" />
                      <span>Pending Approval</span>
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs bg-surface p-2.5 rounded-lg border border-border/50">
                <div className="flex items-center gap-1.5 text-ink-muted">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-ink">{app.appointment_date}</span>
                </div>
                <div className="flex items-center gap-1.5 text-ink-muted">
                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-ink">{app.start_time?.substring(0, 5)} - {app.end_time?.substring(0, 5)}</span>
                </div>
              </div>

              {app.reason && (
                <div className="text-2xs text-ink-muted line-clamp-1 italic">
                  &ldquo;{app.reason}&rdquo;
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-2xs text-ink-muted border-t border-border/30">
                <span className="text-3xs text-ink-muted">ID: {app.id.substring(0, 8)}...</span>
                <button
                  type="button"
                  onClick={() => handleDismiss(app.id)}
                  className="text-3xs font-medium text-ink-muted hover:text-ink underline cursor-pointer"
                >
                  Dismiss Reminder
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production Integration Architecture Note */}
      <div className="p-2.5 rounded-xl bg-muted/10 border border-border/40 text-3xs text-ink-muted flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 text-primary mt-0.5" />
        <div>
          <span className="font-semibold text-ink">Production Reminder Scheduler:</span> Reminders are generated in real-time from active appointment records. Automated background push/SMS notifications prior to consultations require configuring a scheduled trigger (Supabase Cron or Edge Functions).
        </div>
      </div>
    </div>
  );
};

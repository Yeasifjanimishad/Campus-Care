import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Stethoscope,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  Search,
  X,
  FileText,
  UserCheck,
  RefreshCw,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { Appointment, AppointmentStatus, UserProfile } from '../types';
import { AppointmentReminders } from './AppointmentReminders';

interface StudentAppointmentsListProps {
  user?: UserProfile;
  onNavigateToBooking?: () => void;
}

export const StudentAppointmentsList: React.FC<StudentAppointmentsListProps> = ({
  user,
  onNavigateToBooking,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status Filter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cancellation Modal State
  const [cancellingApp, setCancellingApp] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) {
        setError('You must be logged in to view your medical appointments.');
        setLoading(false);
        return;
      }

      // Fetch student's appointments with joined doctor details
      let dbAppointments: Appointment[] = [];
      try {
        const data = await apiFetch('/appointments');
        if (data && data.data) {
          dbAppointments = data.data as Appointment[];
        }
      } catch (fetchErr) {
        console.warn('Failed to fetch from backend', fetchErr);
      }

      // Merge local appointments from localStorage
      let localApps: Appointment[] = [];
      try {
        const stored = localStorage.getItem('campuscare_local_appointments');
        if (stored) {
          localApps = JSON.parse(stored);
        }
      } catch {}

      // Combine and filter out duplicates by id
      const combined = [...localApps, ...dbAppointments];
      const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values());
      setAppointments(unique);
    } catch (err) {
      console.error('[StudentAppointmentsList]: Error loading appointments', err);
      let localApps: Appointment[] = [];
      try {
        const stored = localStorage.getItem('campuscare_local_appointments');
        if (stored) localApps = JSON.parse(stored);
      } catch {}
      setAppointments(localApps);
    } finally {
      setLoading(false);
    }
  };

  const syncCancelledAppointmentLocally = (appointmentId: string) => {
    const updatedAt = new Date().toISOString();

    setAppointments((prev) =>
      prev.map((app) =>
        app.id === appointmentId
          ? { ...app, status: 'cancelled', updated_at: updatedAt }
          : app
      )
    );

    try {
      const stored = localStorage.getItem('campuscare_local_appointments');
      if (stored) {
        const localList: Appointment[] = JSON.parse(stored);
        const updatedList = localList.map((app) =>
          app.id === appointmentId
            ? { ...app, status: 'cancelled', updated_at: updatedAt }
            : app
        );
        localStorage.setItem('campuscare_local_appointments', JSON.stringify(updatedList));
      }
    } catch (storageErr) {
      console.warn('[StudentAppointmentsList]: Failed to persist cancelled appointment locally', storageErr);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingApp) return;

    setIsCancelling(true);
    setCancelError(null);

    const appointmentId = cancellingApp.id;
    let cancelledRemotely = false;

    try {
      // 1. Primary: Use backend API cancel
      await apiFetch(`/appointments/${appointmentId}/cancel`, {
        method: 'POST'
      });

      cancelledRemotely = true;

      // 2. Direct Update Fallback
    } catch (err: unknown) {
      console.warn('[StudentAppointmentsList]: Backend cancel failed, trying direct update fallback', err);

      try {
        const { error: updateErr } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', appointmentId);

        if (updateErr) {
          throw updateErr;
        }

        cancelledRemotely = true;
      } catch (fallbackErr: unknown) {
        console.warn('[StudentAppointmentsList]: Remote cancellation failed, applying local fallback', fallbackErr);
        syncCancelledAppointmentLocally(appointmentId);
        setCancellingApp(null);
        setIsCancelling(false);
        return;
      }
    } finally {
      setIsCancelling(false);
    }

    if (cancelledRemotely) {
      syncCancelledAppointmentLocally(appointmentId);
      setCancellingApp(null);
    }
  };

  // Filter appointments
  const filteredAppointments = appointments.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const docName = app.doctors?.full_name?.toLowerCase() || '';
    const dept = app.doctors?.department?.toLowerCase() || '';
    const reasonText = app.reason?.toLowerCase() || '';

    const matchesQuery =
      !q || docName.includes(q) || dept.includes(q) || reasonText.includes(q);

    return matchesStatus && matchesQuery;
  });

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-2xs font-bold">
            <Clock3 className="w-3 h-3" />
            <span>Pending Review</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-wellness/10 text-wellness border border-wellness/20 text-2xs font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Confirmed Slot</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-medical/10 text-medical border border-medical/20 text-2xs font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink-muted/10 text-ink-muted border border-border text-2xs font-bold">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emergency/10 text-emergency border border-emergency/20 text-2xs font-bold">
            <XCircle className="w-3 h-3" />
            <span>Rejected</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Upcoming Appointment Reminders */}
      <AppointmentReminders user={user} />

      {/* Header bar */}
      <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-xl text-ink">My Medical Appointments</h2>
          <p className="text-xs text-ink-muted">
            Track, manage, and review your campus doctor consultation records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchAppointments()}
            className="p-2.5 rounded-xl border border-border text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors cursor-pointer"
            title="Refresh appointments list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-medical' : ''}`} />
          </button>

          {onNavigateToBooking && (
            <button
              type="button"
              onClick={onNavigateToBooking}
              className="px-4 py-2.5 rounded-xl bg-medical text-surface text-xs font-semibold hover:bg-medical/90 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Book New Appointment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'pending', label: 'Pending' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-medical text-surface shadow-xs'
                  : 'bg-background text-ink-muted hover:text-ink border border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor or reason..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-background text-ink text-xs focus-ring"
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-emergency/10 border border-emergency/30 text-emergency text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Appointments Grid / List */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-surface rounded-2xl border border-border">
          <Loader2 className="w-8 h-8 text-medical animate-spin mx-auto" />
          <p className="text-xs text-ink-muted font-medium">Loading your appointment history...</p>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="py-16 text-center space-y-4 bg-surface rounded-2xl border border-dashed border-border p-8">
          <div className="w-12 h-12 rounded-2xl bg-medical/10 text-medical flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-heading font-bold text-sm text-ink">No Appointments Found</h3>
            <p className="text-xs text-ink-muted">
              {statusFilter !== 'all' || searchQuery
                ? 'No medical appointments match your active filter criteria.'
                : 'You have no scheduled campus doctor consultations.'}
            </p>
          </div>
          {onNavigateToBooking && (
            <button
              type="button"
              onClick={onNavigateToBooking}
              className="px-4 py-2 rounded-xl bg-medical text-surface text-xs font-semibold hover:bg-medical/90 transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Book an Appointment</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppointments.map((app) => {
            const canCancel = app.status === 'pending' || app.status === 'confirmed';

            return (
              <div
                key={app.id}
                className="bg-surface rounded-2xl border border-border p-5 space-y-4 hover:border-border-hover transition-all flex flex-col justify-between shadow-2xs"
              >
                <div className="space-y-3">
                  {/* Card Header: Doctor info + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      {app.doctors?.profile_image_url ? (
                        <img
                          src={app.doctors.profile_image_url}
                          alt={app.doctors.full_name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-medical/10 text-medical font-bold text-xs flex items-center justify-center shrink-0">
                          <Stethoscope className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="font-heading font-bold text-sm text-ink truncate">
                          {app.doctors?.full_name || 'Campus Physician'}
                        </h4>
                        <p className="text-xs text-medical font-medium truncate">
                          {app.doctors?.designation || 'Specialist'}
                        </p>
                        <p className="text-2xs text-ink-muted truncate">
                          {app.doctors?.department}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">{getStatusBadge(app.status)}</div>
                  </div>

                  {/* Date & Time Slot Banner */}
                  <div className="bg-background rounded-xl p-3 border border-border grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-ink">
                      <Calendar className="w-3.5 h-3.5 text-medical shrink-0" />
                      <div>
                        <span className="text-32xs uppercase text-ink-muted block">Date</span>
                        <span className="font-mono font-semibold">{app.appointment_date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-ink">
                      <Clock className="w-3.5 h-3.5 text-wellness shrink-0" />
                      <div>
                        <span className="text-32xs uppercase text-ink-muted block">Time Slot</span>
                        <span className="font-mono font-semibold text-wellness">
                          {app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Medical Reason & Symptoms */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-start gap-1.5 text-ink">
                      <FileText className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-0.5" />
                      <p>
                        <span className="font-semibold text-ink">Reason:</span> {app.reason}
                      </p>
                    </div>

                    {app.symptoms && (
                      <p className="text-2xs text-ink-muted pl-5">
                        <span className="font-medium">Symptoms:</span> {app.symptoms}
                      </p>
                    )}

                    {app.student_note && (
                      <p className="text-2xs text-ink-muted pl-5 italic">
                        &quot;{app.student_note}&quot;
                      </p>
                    )}

                    {app.status === 'completed' && app.doctor_note && (
                      <div className="mt-2 p-2.5 rounded-xl bg-wellness/10 border border-wellness/20 text-2xs space-y-0.5">
                        <span className="font-bold text-wellness uppercase tracking-wider block">Doctor Consultation Note</span>
                        <p className="text-ink">{app.doctor_note}</p>
                      </div>
                    )}

                    {app.status === 'rejected' && app.rejection_reason && (
                      <div className="mt-2 p-2.5 rounded-xl bg-emergency/10 border border-emergency/20 text-2xs space-y-0.5">
                        <span className="font-bold text-emergency uppercase tracking-wider block">Decline Reason</span>
                        <p className="text-ink">{app.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-border/80 flex items-center justify-between">
                  <span className="text-32xs text-ink-muted font-mono">
                    ID: {app.id.slice(0, 8)}
                  </span>

                  {app.status === 'completed' && (
                    <a
                      href="#records"
                      className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-2xs font-semibold hover:bg-primary hover:text-primary-contrast transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Health Record</span>
                    </a>
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setCancellingApp(app)}
                      className="px-3 py-1.5 rounded-lg border border-emergency/30 text-emergency text-2xs font-semibold hover:bg-emergency/10 transition-colors cursor-pointer"
                    >
                      Cancel Appointment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingApp && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emergency/10 text-emergency flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-ink">Cancel Appointment?</h3>
                  <p className="text-2xs text-ink-muted">Confirming will free this time slot for other students.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCancellingApp(null)}
                className="text-ink-muted hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-emergency/10 text-emergency text-xs font-semibold">
                {cancelError}
              </div>
            )}

            <div className="bg-background rounded-xl p-3 border border-border space-y-1 text-xs">
              <p className="font-semibold text-ink">{cancellingApp.doctors?.full_name}</p>
              <p className="text-2xs text-ink-muted font-mono">
                {cancellingApp.appointment_date} at {cancellingApp.start_time.slice(0, 5)} - {cancellingApp.end_time.slice(0, 5)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setCancellingApp(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Keep Appointment
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-emergency text-surface text-xs font-semibold hover:bg-emergency/90 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel Appointment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

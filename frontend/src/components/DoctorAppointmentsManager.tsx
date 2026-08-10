import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, Appointment, Doctor } from '../types';
import { apiFetch } from '../lib/api';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  User,
  FileText,
  Stethoscope,
  Filter,
  Check,
  X,
  MessageSquare,
  Building,
  Mail,
  Phone,
  Calendar,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface DoctorAppointmentsManagerProps {
  user: UserProfile;
}

type FilterTab = 'all' | 'pending' | 'confirmed' | 'today' | 'completed' | 'cancelled_rejected';

export const DoctorAppointmentsManager: React.FC<DoctorAppointmentsManagerProps> = ({ user }) => {
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Appointment for Detail Modal
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Action Modals State
  const [actionModal, setActionModal] = useState<{
    type: 'reject' | 'complete' | null;
    appointment: Appointment | null;
  }>({ type: null, appointment: null });

  const [actionInput, setActionInput] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Helper for today's date in YYYY-MM-DD (local time)
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. Fetch Doctor Profile to determine trusted database doctor_id
  const fetchDoctorProfileAndAppointments = useCallback(async () => {
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        const mockDoctor: Doctor = {
          id: 'demo-doc-1',
          full_name: user.name || 'Dr. Sarah Jenkins',
          specialization: 'General Medicine & Emergency',
          department: 'Medical Center',
          email: user.email || 'doctor@diu.edu.bd',
          phone: user.phone || '+880 1711-223344',
          designation: 'Senior Medical Specialist',
          bio: 'Attending physician with 12+ years of clinical emergency & general medicine experience.',
          doctor_id: user.universityId || 'DOC-8821',
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDoctorProfile(mockDoctor);

        let localApps: Appointment[] = [];
        try {
          const stored = localStorage.getItem('campuscare_local_appointments');
          if (stored) {
            localApps = JSON.parse(stored);
          }
        } catch {}
        setAppointments(localApps);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const authUser = (await supabase.auth.getUser()).data.user;
      if (!authUser) {
        // Fallback for demo logins without auth session
        const mockDoctor: Doctor = {
          id: 'demo-doc-1',
          full_name: user.name || 'Dr. Sarah Jenkins',
          specialization: 'General Medicine & Emergency',
          department: 'Medical Center',
          email: user.email || 'doctor@diu.edu.bd',
          phone: user.phone || '+880 1711-223344',
          designation: 'Senior Medical Specialist',
          bio: 'Attending physician with 12+ years of clinical emergency & general medicine experience.',
          doctor_id: user.universityId || 'DOC-8821',
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDoctorProfile(mockDoctor);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Query public.doctors linked to auth.uid() or email or universityId
      let docData: Doctor | null = null;
      try {
        const search = user.universityId || user.email;
        if (search) {
          const response = await apiFetch(`/doctors?search=${encodeURIComponent(search)}`);
          if (response && response.data && response.data.length > 0) {
            // Find the exact match if possible, or just use the first result
            docData = response.data.find((d: Doctor) => 
              d.doctor_id === user.universityId || 
              d.email?.toLowerCase() === user.email?.toLowerCase()
            ) || response.data[0];
          }
        }
      } catch (e) {
        console.warn('[DoctorAppointmentsManager]: Doctor profile query notice:', e);
      }

      if (!docData) {
        const mockDoctor: Doctor = {
          id: 'demo-doc-1',
          full_name: user.name || 'Dr. Sarah Jenkins',
          specialization: 'General Medicine & Emergency',
          department: 'Medical Center',
          email: user.email || 'doctor@diu.edu.bd',
          phone: user.phone || '+880 1711-223344',
          designation: 'Senior Medical Specialist',
          bio: 'Attending physician with clinical emergency & general medicine experience.',
          doctor_id: user.universityId || 'DOC-8821',
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDoctorProfile(mockDoctor);

        let localApps: Appointment[] = [];
        try {
          const stored = localStorage.getItem('campuscare_local_appointments');
          if (stored) {
            localApps = JSON.parse(stored);
          }
        } catch {}
        setAppointments(localApps);

        setLoading(false);
        setRefreshing(false);
        return;
      }

      setDoctorProfile(docData as Doctor);

      // Fetch appointments assigned ONLY to this doctor
      let fetchedApps: Appointment[] = [];
      try {
        const data = await apiFetch(`/appointments?doctor_id=${docData.id}`);
        if (data && data.data) {
          fetchedApps = data.data as Appointment[];
        }
      } catch (err) {
        console.warn('[DoctorAppointmentsManager] Appointments fetch notice:', err);
      }

      // Merge local storage appointments
      try {
        const stored = localStorage.getItem('campuscare_local_appointments');
        if (stored) {
          const localApps: Appointment[] = JSON.parse(stored);
          const map = new Map<string, Appointment>();
          fetchedApps.forEach((a) => map.set(a.id, a));
          localApps.forEach((a) => {
            if (a.doctor_id === docData.id || a.doctor?.email === docData.email) {
              map.set(a.id, { ...map.get(a.id), ...a });
            }
          });
          fetchedApps = Array.from(map.values());
        }
      } catch (e) {}

      setAppointments(fetchedApps);
    } catch (err: unknown) {
      console.warn('[DoctorAppointmentsManager] Notice loading appointments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.email, user.universityId]);

  useEffect(() => {
    fetchDoctorProfileAndAppointments();
  }, [fetchDoctorProfileAndAppointments]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDoctorProfileAndAppointments();
  };

  // Format 24h TIME string "09:00:00" to "9:00 AM"
  const formatTime12 = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${m} ${ampm}`;
  };

  // Format Date String "2026-08-10" to "Mon, Aug 10, 2026"
  const formatDatePretty = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(`${dateStr}T00:00:00`);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Statistics Calculations
  const todayStr = getTodayDateString();
  const pendingCount = appointments.filter((a) => a.status === 'pending').length;
  const confirmedCount = appointments.filter((a) => a.status === 'confirmed').length;
  const todayCount = appointments.filter((a) => a.appointment_date === todayStr && (a.status === 'pending' || a.status === 'confirmed')).length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;
  const cancelledRejectedCount = appointments.filter((a) => a.status === 'cancelled' || a.status === 'rejected').length;

  // Filtered Appointments
  const filteredAppointments = appointments.filter((app) => {
    // 1. Tab Filter
    if (activeTab === 'pending' && app.status !== 'pending') return false;
    if (activeTab === 'confirmed' && app.status !== 'confirmed') return false;
    if (activeTab === 'today' && app.appointment_date !== todayStr) return false;
    if (activeTab === 'completed' && app.status !== 'completed') return false;
    if (activeTab === 'cancelled_rejected' && app.status !== 'cancelled' && app.status !== 'rejected') return false;

    // 2. Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const studentName = app.student?.name?.toLowerCase() || '';
      const studentId = app.student?.university_id?.toLowerCase() || '';
      const reason = app.reason.toLowerCase();
      const symptoms = app.symptoms?.toLowerCase() || '';
      return (
        studentName.includes(q) ||
        studentId.includes(q) ||
        reason.includes(q) ||
        symptoms.includes(q)
      );
    }

    return true;
  });

  // Helper to sync appointment updates locally and in state
  const updateLocalAndStateAppointment = (appId: string, updates: Partial<Appointment>) => {
    try {
      const stored = localStorage.getItem('campuscare_local_appointments');
      if (stored) {
        const localList: Appointment[] = JSON.parse(stored);
        const index = localList.findIndex((a) => a.id === appId);
        if (index !== -1) {
          localList[index] = { ...localList[index], ...updates, updated_at: new Date().toISOString() };
          localStorage.setItem('campuscare_local_appointments', JSON.stringify(localList));
        }
      }
    } catch (e) {
      console.warn('Failed updating local storage appointment:', e);
    }

    setAppointments((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, ...updates, updated_at: new Date().toISOString() } : app))
    );

    if (selectedAppointment?.id === appId) {
      setSelectedAppointment((prev) => (prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : null));
    }
  };

  // Action Handlers
  const handleConfirmAppointment = async (appId: string) => {
    setActionSubmitting(true);
    setError(null);

    try {
      await apiFetch(`/appointments/${appId}/confirm`, {
        method: 'POST'
      });
    } catch (err: unknown) {
      console.warn('Confirm RPC notice, fallback applied:', err);
    }

    updateLocalAndStateAppointment(appId, { status: 'confirmed' });
    setActionSubmitting(false);
  };

  const handleOpenActionModal = (type: 'reject' | 'complete', app: Appointment) => {
    setActionError(null);
    setActionInput('');
    setActionModal({ type, appointment: app });
  };

  const handleCloseActionModal = () => {
    if (!actionSubmitting) {
      setActionModal({ type: null, appointment: null });
      setActionInput('');
      setActionError(null);
    }
  };

  const handleActionModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.appointment || !actionModal.type) return;

    setActionSubmitting(true);
    setActionError(null);

    const appId = actionModal.appointment.id;
    const noteOrReason = actionInput.trim() || null;

    try {
      if (actionModal.type === 'reject') {
        try {
          await apiFetch(`/appointments/${appId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ rejection_reason: noteOrReason })
          });
        } catch (err: unknown) {
          console.warn('Reject RPC notice, fallback applied:', err);
        }

        updateLocalAndStateAppointment(appId, { status: 'rejected', rejection_reason: noteOrReason });
        handleCloseActionModal();
      } else if (actionModal.type === 'complete') {
        try {
          await apiFetch(`/appointments/${appId}/complete`, {
            method: 'POST',
            body: JSON.stringify({ doctor_note: noteOrReason })
          });
        } catch (err: unknown) {
          console.warn('Complete RPC notice, fallback applied:', err);
        }

        updateLocalAndStateAppointment(appId, { status: 'completed', doctor_note: noteOrReason });
        handleCloseActionModal();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while updating the appointment.';
      setActionError(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-2xs font-bold border border-amber-500/20">
            <AlertCircle className="w-3 h-3" /> Pending Review
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-wellness/10 text-wellness text-2xs font-bold border border-wellness/20">
            <CheckCircle2 className="w-3 h-3" /> Confirmed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-2xs font-bold border border-primary/20">
            <Check className="w-3 h-3" /> Completed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-2xs font-bold border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-ink-muted/10 text-ink-muted text-2xs font-bold border border-ink-muted/20">
            <X className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center space-y-4 shadow-xs">
        <div className="w-10 h-10 border-3 border-medical border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-ink-muted font-medium">Synchronizing physician consultation schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Doctor Profile Info */}
      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-medical/10 text-medical text-xs font-semibold">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Campus Physician Portal</span>
            </div>
            <h1 className="font-heading font-bold text-2xl text-ink">
              Clinical Appointment Management
            </h1>
            <p className="text-xs text-ink-muted">
              Review patient consultation requests, confirm slot bookings, and record visit outcomes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {doctorProfile && (
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-ink">{doctorProfile.full_name}</p>
                <p className="text-2xs text-ink-muted">{doctorProfile.specialization}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-border text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh Schedule"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* 2. Real Database Statistics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-background rounded-xl p-3.5 border border-border space-y-1">
            <p className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">Pending Review</p>
            <p className="font-heading font-bold text-xl text-amber-600">{pendingCount}</p>
          </div>

          <div className="bg-background rounded-xl p-3.5 border border-border space-y-1">
            <p className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">Confirmed Slots</p>
            <p className="font-heading font-bold text-xl text-wellness">{confirmedCount}</p>
          </div>

          <div className="bg-background rounded-xl p-3.5 border border-border space-y-1">
            <p className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">Today's Queue</p>
            <p className="font-heading font-bold text-xl text-medical">{todayCount}</p>
          </div>

          <div className="bg-background rounded-xl p-3.5 border border-border space-y-1">
            <p className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">Completed Visits</p>
            <p className="font-heading font-bold text-xl text-primary">{completedCount}</p>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-background rounded-xl p-3.5 border border-border space-y-1">
            <p className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">Declined / Cancelled</p>
            <p className="font-heading font-bold text-xl text-ink-muted">{cancelledRejectedCount}</p>
          </div>
        </div>
      </div>

      {/* 3. Error Banner if any */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Controls Bar: Filter Tabs & Search */}
      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-medical text-surface shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              All ({appointments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-surface shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-2xs font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('confirmed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'confirmed'
                  ? 'bg-wellness text-surface shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              Confirmed ({confirmedCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'today'
                  ? 'bg-primary text-surface shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              Today's Queue ({todayCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-medical text-surface shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              Completed ({completedCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cancelled_rejected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'cancelled_rejected'
                  ? 'bg-ink-muted text-surface shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              Declined ({cancelledRejectedCount})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, ID, reason..."
              className="w-full pl-9 pr-8 py-1.5 bg-background border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-medical"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Appointments List / Cards */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-medical/10 text-medical mx-auto flex items-center justify-center">
            <CalendarDays className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-semibold text-base text-ink">No Appointments Found</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {searchQuery
              ? `No appointments match your search "${searchQuery}".`
              : activeTab !== 'all'
              ? `There are currently no appointments in the "${activeTab}" category.`
              : 'No patient appointments have been scheduled for your profile yet.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppointments.map((app) => {
            const isToday = app.appointment_date === todayStr;

            return (
              <div
                key={app.id}
                className={`bg-surface rounded-2xl border p-5 space-y-4 transition-all hover:shadow-xs flex flex-col justify-between ${
                  isToday ? 'border-medical/40 bg-medical/[0.02]' : 'border-border'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Date & Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-medical/10 text-medical">
                        <Calendar className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-xs font-semibold text-ink">
                        {formatDatePretty(app.appointment_date)}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.2 rounded bg-medical text-surface text-3xs font-extrabold uppercase">
                          Today
                        </span>
                      )}
                    </div>
                    {renderStatusBadge(app.status)}
                  </div>

                  {/* Student Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-medical shrink-0" />
                        <h4 className="font-heading font-bold text-sm text-ink">
                          {app.student?.name || 'Student Patient'}
                        </h4>
                      </div>
                      {app.student?.university_id && (
                        <p className="text-2xs text-ink-muted font-mono pl-5">
                          ID: {app.student.university_id}
                          {app.student.department ? ` • ${app.student.department}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-medical font-mono">
                        {formatTime12(app.start_time)} - {formatTime12(app.end_time)}
                      </p>
                      <p className="text-3xs text-ink-muted">30 min slot</p>
                    </div>
                  </div>

                  {/* Reason & Symptoms */}
                  <div className="p-3 rounded-xl bg-background border border-border/80 space-y-1 text-xs">
                    <p className="font-semibold text-ink flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                      <span>{app.reason}</span>
                    </p>
                    {app.symptoms && (
                      <p className="text-ink-muted text-2xs pl-5 line-clamp-2">
                        <span className="font-medium text-ink">Symptoms:</span> {app.symptoms}
                      </p>
                    )}
                  </div>

                  {/* Doctor Consultation Note / Rejection Reason if present */}
                  {app.status === 'completed' && app.doctor_note && (
                    <div className="p-2.5 rounded-xl bg-wellness/10 border border-wellness/20 text-xs space-y-0.5">
                      <p className="font-bold text-wellness text-2xs uppercase tracking-wider flex items-center gap-1">
                        <Check className="w-3 h-3" /> Consultation Note
                      </p>
                      <p className="text-ink text-2xs italic">{app.doctor_note}</p>
                    </div>
                  )}

                  {app.status === 'rejected' && app.rejection_reason && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-0.5">
                      <p className="font-bold text-rose-600 text-2xs uppercase tracking-wider flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Reason for Decline
                      </p>
                      <p className="text-ink text-2xs italic">{app.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAppointment(app)}
                    className="text-2xs text-ink-muted hover:text-ink font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <div className="flex items-center gap-2">
                    {app.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenActionModal('reject', app)}
                          disabled={actionSubmitting}
                          className="px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmAppointment(app.id)}
                          disabled={actionSubmitting}
                          className="px-3 py-1 rounded-lg bg-wellness text-surface hover:bg-wellness-hover text-xs font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm</span>
                        </button>
                      </>
                    )}

                    {app.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleOpenActionModal('complete', app)}
                        disabled={actionSubmitting}
                        className="px-3 py-1 rounded-lg bg-medical text-surface hover:bg-medical-hover text-xs font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-lg w-full space-y-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="space-y-0.5">
                <span className="text-3xs font-mono text-ink-muted uppercase">Ref ID: {selectedAppointment.id.slice(0, 8)}</span>
                <h3 className="font-heading font-bold text-lg text-ink">
                  Appointment Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Header */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
              <span className="text-xs text-ink-muted font-medium">Current Status</span>
              {renderStatusBadge(selectedAppointment.status)}
            </div>

            {/* Student Info Section */}
            <div className="space-y-2">
              <h4 className="text-2xs font-extrabold uppercase tracking-wider text-ink-muted">
                Student Patient Profile
              </h4>
              <div className="p-4 rounded-xl bg-background border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{selectedAppointment.student?.name || 'N/A'}</span>
                  {selectedAppointment.student?.university_id && (
                    <span className="px-2 py-0.5 rounded bg-surface border border-border font-mono text-2xs">
                      ID: {selectedAppointment.student.university_id}
                    </span>
                  )}
                </div>
                {selectedAppointment.student?.email && (
                  <p className="text-ink-muted flex items-center gap-1.5 text-2xs">
                    <Mail className="w-3 h-3 text-ink-muted" />
                    <span>{selectedAppointment.student.email}</span>
                  </p>
                )}
                {selectedAppointment.student?.department && (
                  <p className="text-ink-muted flex items-center gap-1.5 text-2xs">
                    <Building className="w-3 h-3 text-ink-muted" />
                    <span>{selectedAppointment.student.department}</span>
                  </p>
                )}
                {selectedAppointment.student?.phone && (
                  <p className="text-ink-muted flex items-center gap-1.5 text-2xs">
                    <Phone className="w-3 h-3 text-ink-muted" />
                    <span>{selectedAppointment.student.phone}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Slot & Reason Section */}
            <div className="space-y-2">
              <h4 className="text-2xs font-extrabold uppercase tracking-wider text-ink-muted">
                Schedule & Clinical Reason
              </h4>
              <div className="p-4 rounded-xl bg-background border border-border space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-2xs text-ink-muted block">Date</span>
                    <span className="font-semibold text-ink">{formatDatePretty(selectedAppointment.appointment_date)}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-ink-muted block">Time Slot</span>
                    <span className="font-semibold text-medical font-mono">
                      {formatTime12(selectedAppointment.start_time)} - {formatTime12(selectedAppointment.end_time)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border pt-2 space-y-1">
                  <span className="text-2xs text-ink-muted block font-medium">Chief Complaint / Reason</span>
                  <p className="font-medium text-ink">{selectedAppointment.reason}</p>
                </div>

                {selectedAppointment.symptoms && (
                  <div className="border-t border-border pt-2 space-y-1">
                    <span className="text-2xs text-ink-muted block font-medium">Reported Symptoms</span>
                    <p className="text-ink-muted">{selectedAppointment.symptoms}</p>
                  </div>
                )}

                {selectedAppointment.student_note && (
                  <div className="border-t border-border pt-2 space-y-1">
                    <span className="text-2xs text-ink-muted block font-medium">Student Additional Note</span>
                    <p className="text-ink-muted italic">{selectedAppointment.student_note}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Doctor Note / Rejection Reason in Modal */}
            {selectedAppointment.doctor_note && (
              <div className="p-4 rounded-xl bg-wellness/10 border border-wellness/20 text-xs space-y-1">
                <span className="font-bold text-wellness text-2xs uppercase tracking-wider">Physician Consultation Note</span>
                <p className="text-ink">{selectedAppointment.doctor_note}</p>
              </div>
            )}

            {selectedAppointment.rejection_reason && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                <span className="font-bold text-rose-600 text-2xs uppercase tracking-wider">Decline Reason</span>
                <p className="text-ink">{selectedAppointment.rejection_reason}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
              {selectedAppointment.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const app = selectedAppointment;
                      setSelectedAppointment(null);
                      handleOpenActionModal('reject', app);
                    }}
                    className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer"
                  >
                    Decline Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleConfirmAppointment(selectedAppointment.id);
                    }}
                    className="px-4 py-2 rounded-xl bg-wellness text-surface hover:bg-wellness-hover text-xs font-semibold cursor-pointer"
                  >
                    Confirm Appointment
                  </button>
                </>
              )}

              {selectedAppointment.status === 'confirmed' && (
                <button
                  type="button"
                  onClick={() => {
                    const app = selectedAppointment;
                    setSelectedAppointment(null);
                    handleOpenActionModal('complete', app);
                  }}
                  className="px-4 py-2 rounded-xl bg-medical text-surface hover:bg-medical-hover text-xs font-semibold cursor-pointer"
                >
                  Mark Completed
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="px-4 py-2 rounded-xl border border-border text-ink hover:bg-surface-hover text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Action Input Modal (Reject Reason or Consultation Complete Note) */}
      {actionModal.type && actionModal.appointment && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-heading font-bold text-base text-ink">
                {actionModal.type === 'reject' ? 'Decline Appointment Request' : 'Complete Patient Consultation'}
              </h3>
              <button
                type="button"
                onClick={handleCloseActionModal}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleActionModalSubmit} className="space-y-4">
              <div className="space-y-1 text-xs">
                <p className="text-ink font-semibold">
                  Patient: {actionModal.appointment.student?.name || 'Student'}
                </p>
                <p className="text-ink-muted">
                  Slot: {formatDatePretty(actionModal.appointment.appointment_date)} at {formatTime12(actionModal.appointment.start_time)}
                </p>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs">
                  {actionError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">
                  {actionModal.type === 'reject'
                    ? 'Reason for Declining (Optional)'
                    : 'Consultation & Prescription Summary Note (Optional)'}
                </label>
                <textarea
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  placeholder={
                    actionModal.type === 'reject'
                      ? 'e.g. Schedule emergency conflict / Please select another available slot.'
                      : 'e.g. Patient presented with mild viral fever. Prescribed Paracetamol 500mg, recommended 2 days rest.'
                  }
                  rows={3}
                  className="w-full p-3 bg-background border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-medical resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseActionModal}
                  disabled={actionSubmitting}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-ink hover:bg-surface-hover font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className={`px-4 py-2 rounded-xl text-xs text-surface font-semibold cursor-pointer transition-colors ${
                    actionModal.type === 'reject'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-medical hover:bg-medical-hover'
                  }`}
                >
                  {actionSubmitting
                    ? 'Saving...'
                    : actionModal.type === 'reject'
                    ? 'Decline Appointment'
                    : 'Complete Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

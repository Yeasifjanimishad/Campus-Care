import React, { useEffect, useState, useCallback } from 'react';
import {
  Stethoscope,
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Building2,
  Award,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  UserCheck
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { Doctor, UserProfile } from '../types';

interface DoctorDirectoryProps {
  user?: UserProfile;
}

export const DoctorDirectory: React.FC<DoctorDirectoryProps> = ({ user }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [updatingAvailabilityId, setUpdatingAvailabilityId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    let remoteDoctors: Doctor[] = [];
    let remoteDoctorUsers: any[] = [];
    let remoteApprovedRequests: any[] = [];

    if (isSupabaseConfigured) {
      try {
        const queryParams = new URLSearchParams();
        if (selectedDept !== 'All') queryParams.append('department', selectedDept);
        if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());

        const response = await apiFetch(`/doctors?${queryParams.toString()}`);
        if (response && response.data) {
          remoteDoctors = response.data;
        }
      } catch (err) {
        console.warn('[Fetch Doctors] API error:', err);
      }

      try {
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'doctor');
        if (data && data.length > 0) remoteDoctorUsers = data;
      } catch (err) {}

      try {
        const { data } = await supabase
            .from('doctor_access_requests')
            .select('*')
            .eq('status', 'approved');
        if (data && data.length > 0) remoteApprovedRequests = data;
      } catch (err) {}
    }

    const map = new Map<string, Doctor>();

    // 1. Remote doctors table (already filtered by API)
    remoteDoctors.forEach((d) => map.set(d.email.toLowerCase(), d));

    // 3. Remote users table where role = 'doctor'
    remoteDoctorUsers.forEach((u) => {
      const key = u.email?.toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, {
          id: u.id || 'doc-' + key,
          doctor_id: u.university_id || u.universityId || 'DOC-' + Math.floor(1000 + Math.random() * 9000),
          full_name: u.name?.startsWith('Dr.') ? u.name : `Dr. ${u.name || 'Medical Officer'}`,
          email: u.email,
          department: u.department || 'Medical Center',
          specialization: 'General Medicine & Clinical Care',
          designation: 'Medical Officer / Doctor',
          phone: u.phone || '+880 1700-000000',
          bio: 'Campus medical officer providing healthcare services.',
          profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
          is_available: true,
          created_at: u.created_at || new Date().toISOString(),
          updated_at: u.updated_at || new Date().toISOString(),
        });
      }
    });

    // 4. Remote approved doctor access requests
    remoteApprovedRequests.forEach((req) => {
      const key = req.email?.toLowerCase();
      if (key) {
        map.set(key, {
          id: req.user_id || req.id || 'doc-' + key,
          doctor_id: req.university_id || 'DOC-' + Math.floor(1000 + Math.random() * 9000),
          full_name: req.full_name?.startsWith('Dr.') ? req.full_name : `Dr. ${req.full_name || 'Medical Officer'}`,
          email: req.email,
          department: req.department || 'Medical Center',
          specialization: 'General Medicine & Clinical Care',
          designation: 'Medical Officer / Doctor',
          phone: req.phone || '+880 1700-000000',
          bio: req.message || 'Campus medical officer providing healthcare services.',
          profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
          is_available: true,
          created_at: req.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    // Only backend/Supabase doctor sources are used.

    setDoctors(Array.from(map.values()));
    setLoading(false);
  }, [selectedDept, searchQuery]);

  // Debounce effect for search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDoctors();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchDoctors]);

  // Filter logic
  const departments = ['All', ...Array.from(new Set(doctors.map((d) => d.department)))];

  const filteredDoctors = doctors.filter((doc) => {
    const matchesDept = selectedDept === 'All' || doc.department === selectedDept;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
        !query ||
        doc.full_name.toLowerCase().includes(query) ||
        doc.specialization.toLowerCase().includes(query) ||
        doc.department.toLowerCase().includes(query) ||
        doc.doctor_id.toLowerCase().includes(query);

    return matchesDept && matchesQuery;
  });

  // Toggle Doctor Availability (for Doctor user)
  const handleToggleAvailability = async (doc: Doctor) => {
    setUpdatingAvailabilityId(doc.id);
    setStatusMessage(null);
    const newStatus = !doc.is_available;

    try {
      if (isSupabaseConfigured) {
        const response = await apiFetch(`/doctors/${doc.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            is_available: newStatus
          })
        });

        if (response) {
          setDoctors((prev) =>
              prev.map((item) => (item.id === doc.id ? { ...item, is_available: newStatus } : item))
          );
          setStatusMessage({
            type: 'success',
            message: `Availability updated to ${newStatus ? 'Available' : 'Unavailable'}.`,
          });
        }
      } else {
        // Fallback for local testing without Supabase
        setDoctors((prev) =>
            prev.map((item) => (item.id === doc.id ? { ...item, is_available: newStatus } : item))
        );
        setStatusMessage({
          type: 'success',
          message: `Availability updated to ${newStatus ? 'Available' : 'Unavailable'}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage({ type: 'error', message: `Update error: ${msg}` });
    } finally {
      setUpdatingAvailabilityId(null);
    }
  };

  return (
      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-medical/10 text-medical text-xs font-semibold">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Campus Medical Staff Directory</span>
            </div>
            <h2 className="font-heading font-bold text-xl text-ink">
              Campus Care Physicians & Specialists
            </h2>
            <p className="text-xs text-ink-muted">
              Verified doctors available for campus clinical consultations and student healthcare services.
            </p>
          </div>

          <button
              onClick={fetchDoctors}
              disabled={loading}
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors focus-ring self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh List</span>
          </button>
        </div>

        {statusMessage && (
            <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    statusMessage.type === 'success'
                        ? 'bg-wellness/10 border-wellness/30 text-wellness'
                        : 'bg-emergency/10 border-emergency/30 text-emergency'
                }`}
            >
              {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.message}</span>
            </div>
        )}

        {/* Search & Department Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by doctor name, specialization, or department..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-ink text-xs focus-ring"
            />
          </div>

          {/* Department Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {departments.map((dept) => (
                <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors focus-ring cursor-pointer ${
                        selectedDept === dept
                            ? 'bg-medical text-surface shadow-xs'
                            : 'bg-background text-ink-muted hover:text-ink border border-border'
                    }`}
                >
                  {dept}
                </button>
            ))}
          </div>
        </div>

        {/* Doctor Cards Grid */}
        {loading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-medical animate-spin mx-auto" />
              <p className="text-xs text-ink-muted font-medium">Loading verified campus physicians...</p>
            </div>
        ) : filteredDoctors.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-background rounded-2xl border border-dashed border-border p-6">
              <Stethoscope className="w-8 h-8 text-ink-muted mx-auto" />
              <h3 className="font-heading font-semibold text-sm text-ink">No Doctors Found</h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                No campus medical personnel matched your search query or department filter.
              </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDoctors.map((doc) => {
                const isSelfDoctor =
                    user?.role === 'doctor' &&
                    (user.email.toLowerCase() === doc.email.toLowerCase() ||
                        user.universityId === doc.doctor_id ||
                        user.name.toLowerCase() === doc.full_name.toLowerCase());

                const isUpdatingThis = updatingAvailabilityId === doc.id;

                return (
                    <div
                        key={doc.id}
                        className="bg-background rounded-2xl border border-border p-5 space-y-4 flex flex-col justify-between hover:border-medical/40 transition-all shadow-2xs group"
                    >
                      <div className="space-y-4">
                        {/* Top Bar: Availability status & Doctor ID */}
                        <div className="flex items-center justify-between text-xs">
                          <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold ${
                                  doc.is_available
                                      ? 'bg-wellness/10 text-wellness border border-wellness/20'
                                      : 'bg-ink-muted/10 text-ink-muted border border-border'
                              }`}
                          >
                            {doc.is_available ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-wellness" />
                                  <span>Available Today</span>
                                </>
                            ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-ink-muted" />
                                  <span>Unavailable</span>
                                </>
                            )}
                          </div>

                          <span className="font-mono text-2xs text-ink-muted px-2 py-0.5 rounded bg-surface border border-border">
                      {doc.doctor_id}
                    </span>
                        </div>

                        {/* Doctor Info Header */}
                        <div className="flex items-start gap-3.5">
                          {doc.profile_image_url ? (
                              <img
                                  src={doc.profile_image_url}
                                  alt={doc.full_name}
                                  referrerPolicy="no-referrer"
                                  className="w-13 h-13 rounded-2xl object-cover border border-border shrink-0 shadow-2xs"
                              />
                          ) : (
                              <div className="w-13 h-13 rounded-2xl bg-medical/10 text-medical font-bold text-base flex items-center justify-center shrink-0 border border-medical/20">
                                {doc.full_name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)}
                              </div>
                          )}

                          <div className="space-y-1 min-w-0 flex-1">
                            <h3 className="font-heading font-bold text-base text-ink truncate group-hover:text-medical transition-colors">
                              {doc.full_name}
                            </h3>
                            <p className="text-xs text-medical font-medium truncate flex items-center gap-1">
                              <Award className="w-3 h-3 shrink-0" />
                              <span>{doc.designation || 'Medical Consultant'}</span>
                            </p>
                            <p className="text-xs text-ink-muted truncate flex items-center gap-1">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span>{doc.department}</span>
                            </p>
                          </div>
                        </div>

                        {/* Specialization Pill */}
                        <div className="pt-2 border-t border-border/60">
                    <span className="text-2xs font-semibold text-ink-muted uppercase tracking-wider block mb-1">
                      Specialization
                    </span>
                          <p className="text-xs font-semibold text-ink bg-surface px-3 py-1.5 rounded-xl border border-border">
                            {doc.specialization}
                          </p>
                        </div>

                        {/* Bio */}
                        {doc.bio && (
                            <p className="text-xs text-ink-muted leading-relaxed line-clamp-2 italic">
                              "{doc.bio}"
                            </p>
                        )}

                        {/* Contact Info */}
                        <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs text-ink-muted">
                          {doc.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-medical shrink-0" />
                                <span className="font-mono text-2xs">{doc.phone}</span>
                              </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-mono text-2xs truncate">{doc.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action: Doctor self-toggle or booking teaser */}
                      <div className="pt-3 border-t border-border flex items-center justify-between">
                        {isSelfDoctor ? (
                            <button
                                onClick={() => handleToggleAvailability(doc)}
                                disabled={isUpdatingThis}
                                type="button"
                                className="w-full py-2 px-3 rounded-xl bg-surface border border-medical/30 text-medical font-semibold text-xs hover:bg-medical/10 transition-colors flex items-center justify-center gap-2 focus-ring cursor-pointer"
                            >
                              {isUpdatingThis ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : doc.is_available ? (
                                  <ToggleRight className="w-4 h-4 text-wellness" />
                              ) : (
                                  <ToggleLeft className="w-4 h-4 text-ink-muted" />
                              )}
                              <span>
                        {doc.is_available ? 'Mark as Unavailable' : 'Mark as Available'}
                      </span>
                            </button>
                        ) : (
                            <div className="w-full flex items-center justify-between text-2xs text-ink-muted">
                              <span className="italic">Verified Campus Physician</span>
                              <span className="font-semibold text-medical flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        <span>Clinic Staff</span>
                      </span>
                            </div>
                        )}
                      </div>
                    </div>
                );
              })}
            </div>
        )}
      </div>
  );
};

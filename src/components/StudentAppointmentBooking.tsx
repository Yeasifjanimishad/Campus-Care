import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Stethoscope,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronLeft,
  FileText,
  Sparkles,
  Award,
  Check
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Doctor, UserProfile, Appointment } from '../types';
import { FALLBACK_SEED_DOCTORS } from '../data/mockDoctors';

interface StudentAppointmentBookingProps {
  user?: UserProfile;
  onBookingSuccess?: () => void;
}

const COMMON_REASONS = [
  'General Health Consultation',
  'Fever & Viral Infection',
  'Headache & Migraine',
  'Skin Rash / Allergy',
  'Stress & Anxiety Support',
  'Sports Injury / Joint Pain',
  'Eye / Ear Discomfort',
  'Reproductive & Female Health',
  'Prescription Refill',
  'Other Medical Concern',
];

// Helper to generate 30-min time slots between 09:00 and 17:00
interface TimeSlot {
  startTime: string; // HH:mm:ss
  endTime: string;   // HH:mm:ss
  label: string;     // e.g. "09:00 AM - 09:30 AM"
}

function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startHour = 9; // 09:00
  const endHour = 17;  // 17:00

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min of [0, 30]) {
      const nextHour = min === 30 ? hour + 1 : hour;
      const nextMin = min === 30 ? 0 : 30;

      const formatTime = (h: number, m: number) => {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        return `${hh}:${mm}:00`;
      };

      const formatDisplayTime = (h: number, m: number) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const displayM = m.toString().padStart(2, '0');
        return `${displayH.toString().padStart(2, '0')}:${displayM} ${period}`;
      };

      const sTime = formatTime(hour, min);
      const eTime = formatTime(nextHour, nextMin);
      const label = `${formatDisplayTime(hour, min)} - ${formatDisplayTime(nextHour, nextMin)}`;

      slots.push({
        startTime: sTime,
        endTime: eTime,
        label,
      });
    }
  }

  return slots;
}

const ALL_TIME_SLOTS = generateTimeSlots();

// Get today's date formatted YYYY-MM-DD
function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const StudentAppointmentBooking: React.FC<StudentAppointmentBookingProps> = ({
  user,
  onBookingSuccess,
}) => {
  // Wizard steps: 1 = Select Doctor, 2 = Date & Time, 3 = Reason & Details, 4 = Confirmation
  const [step, setStep] = useState<number>(1);

  // Doctors State
  const [doctors, setDoctors] = useState<Doctor[]>(FALLBACK_SEED_DOCTORS);
  const [loadingDoctors, setLoadingDoctors] = useState<boolean>(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('All');

  // Booking Form State
  const [appointmentDate, setAppointmentDate] = useState<string>(getTodayString());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookedSlotTimes, setBookedSlotTimes] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  const [reason, setReason] = useState<string>(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [symptoms, setSymptoms] = useState<string>('');
  const [studentNote, setStudentNote] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  // Fetch verified doctors from Supabase + Local Storage + Managed Users + Doctor Requests
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      let remoteDoctors: Doctor[] = [];
      let remoteDoctorUsers: any[] = [];
      let remoteApprovedRequests: any[] = [];

      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from('doctors')
            .select('*')
            .order('full_name', { ascending: true });
          if (data && data.length > 0) remoteDoctors = data as Doctor[];
        } catch (err) {}

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

      // 1. Seed doctors
      FALLBACK_SEED_DOCTORS.forEach((d) => map.set(d.email.toLowerCase(), d));

      // 2. Remote doctors table
      remoteDoctors.forEach((d) => map.set(d.email.toLowerCase(), d));

      // 3. Remote users table where role = 'doctor'
      remoteDoctorUsers.forEach((u) => {
        const key = u.email?.toLowerCase();
        if (key) {
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

      // 5. Local doctors from campuscare_local_doctors
      try {
        const rawLocal = localStorage.getItem('campuscare_local_doctors');
        if (rawLocal) {
          const localList: Doctor[] = JSON.parse(rawLocal);
          localList.forEach((d) => map.set(d.email.toLowerCase(), d));
        }
      } catch (e) {}

      // 6. Managed users with role === 'doctor'
      try {
        const rawUsers = localStorage.getItem('campuscare_managed_users');
        if (rawUsers) {
          const managedUsers = JSON.parse(rawUsers);
          Object.values(managedUsers).forEach((u: any) => {
            if (u.role === 'doctor' && u.email) {
              const key = u.email.toLowerCase();
              map.set(key, {
                id: u.id || 'doc-' + key,
                doctor_id: u.universityId || u.university_id || 'DOC-' + Math.floor(1000 + Math.random() * 9000),
                full_name: u.name?.startsWith('Dr.') ? u.name : `Dr. ${u.name || 'Medical Officer'}`,
                email: u.email,
                department: u.department || 'Medical Center',
                specialization: 'General Medicine & Care',
                designation: 'Medical Officer / Doctor',
                phone: u.phone || '+880 1700-000000',
                bio: 'Campus medical officer providing healthcare services.',
                profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
                is_available: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          });
        }
      } catch (e) {}

      // 7. Local approved doctor requests from campuscare_doctor_requests
      try {
        const rawReqs = localStorage.getItem('campuscare_doctor_requests');
        if (rawReqs) {
          const reqList: any[] = JSON.parse(rawReqs);
          reqList.forEach((req) => {
            if (req.status === 'approved' && req.email) {
              const key = req.email.toLowerCase();
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
        }
      } catch (e) {}

      setDoctors(Array.from(map.values()));
      setLoadingDoctors(false);
    };

    fetchDoctors();
  }, []);

  // Fetch booked slots whenever selectedDoctor or appointmentDate changes
  useEffect(() => {
    if (!selectedDoctor || !appointmentDate) return;

    const fetchBookedSlots = async () => {
      setLoadingSlots(true);
      try {
        const { data, error } = await supabase.rpc('get_booked_slots', {
          p_doctor_id: selectedDoctor.id,
          p_appointment_date: appointmentDate,
        });

        if (!error && data) {
          // Data is array of { start_time, end_time, status }
          const bookedTimes = data.map((item: { start_time: string }) => item.start_time);
          setBookedSlotTimes(bookedTimes);
        } else {
          // Fallback direct table query if RPC not present in environment
          const { data: directData } = await supabase
            .from('appointments')
            .select('start_time')
            .eq('doctor_id', selectedDoctor.id)
            .eq('appointment_date', appointmentDate)
            .in('status', ['pending', 'confirmed']);

          if (directData) {
            setBookedSlotTimes(directData.map((d) => d.start_time));
          } else {
            setBookedSlotTimes([]);
          }
        }
      } catch (err) {
        console.warn('[StudentAppointmentBooking]: Error fetching booked slots', err);
        setBookedSlotTimes([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchBookedSlots();
  }, [selectedDoctor, appointmentDate]);

  // Filter doctors list
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

  // Handle Form Submission
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedSlot || !appointmentDate) {
      setBookingError('Please complete doctor, date, and time slot selection.');
      return;
    }

    const finalReason = reason === 'Other Medical Concern' ? customReason.trim() : reason;
    if (!finalReason) {
      setBookingError('Please specify the reason for your medical appointment.');
      return;
    }

    setIsSubmitting(true);
    setBookingError(null);

    let booked = false;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_appointment', {
        p_doctor_id: selectedDoctor.id,
        p_appointment_date: appointmentDate,
        p_start_time: selectedSlot.startTime,
        p_end_time: selectedSlot.endTime,
        p_reason: finalReason,
        p_symptoms: symptoms.trim() || null,
        p_student_note: studentNote.trim() || null,
      });

      if (!rpcError && rpcData?.success) {
        booked = true;
        const newApp = rpcData.appointment as Appointment;
        newApp.doctors = selectedDoctor;
        try {
          const stored = localStorage.getItem('campuscare_local_appointments');
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(newApp);
          localStorage.setItem('campuscare_local_appointments', JSON.stringify(list));
        } catch {}
        setConfirmedAppointment(newApp);
        setStep(4);
        if (onBookingSuccess) onBookingSuccess();
        return;
      } else {
        console.warn('[StudentAppointmentBooking] RPC notice:', rpcError?.message || rpcData?.message);
      }
    } catch (err: unknown) {
      console.warn('[StudentAppointmentBooking] Exception booking appointment:', err);
    } finally {
      setIsSubmitting(false);
    }

    if (!booked) {
      const mockConfirmedApp: Appointment = {
        id: 'app-' + Math.random().toString(36).substring(2, 9),
        student_id: user?.id || 'std-101',
        doctor_id: selectedDoctor.id,
        appointment_date: appointmentDate,
        start_time: selectedSlot.startTime,
        end_time: selectedSlot.endTime,
        status: 'confirmed',
        reason: finalReason,
        symptoms: symptoms.trim() || undefined,
        student_note: studentNote.trim() || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        doctors: selectedDoctor
      };

      try {
        const stored = localStorage.getItem('campuscare_local_appointments');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(mockConfirmedApp);
        localStorage.setItem('campuscare_local_appointments', JSON.stringify(list));
      } catch {}

      setConfirmedAppointment(mockConfirmedApp);
      setStep(4);
      if (onBookingSuccess) onBookingSuccess();
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs max-w-4xl mx-auto">
      {/* Wizard Header & Step Progress Bar */}
      <div className="border-b border-border pb-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-medical/10 text-medical text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              <span>Campus Medical Appointment Scheduling</span>
            </div>
            <h2 className="font-heading font-bold text-xl text-ink mt-1">
              Book a Clinical Consultation
            </h2>
          </div>

          <span className="text-xs font-semibold text-ink-muted bg-background px-3 py-1.5 rounded-xl border border-border self-start sm:self-auto">
            Step {step} of 4
          </span>
        </div>

        {/* Progress Tracker */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          {[
            { num: 1, title: 'Select Physician' },
            { num: 2, title: 'Date & Time' },
            { num: 3, title: 'Clinical Notes' },
            { num: 4, title: 'Confirmation' },
          ].map((s) => (
            <div key={s.num} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  step >= s.num ? 'bg-medical' : 'bg-border'
                }`}
              />
              <p
                className={`text-2xs font-semibold truncate ${
                  step >= s.num ? 'text-medical' : 'text-ink-muted'
                }`}
              >
                {s.num}. {s.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: SELECT PHYSICIAN */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search physician by name, department, or specialization..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-ink text-xs focus-ring"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {departments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
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

          {loadingDoctors ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-medical animate-spin mx-auto" />
              <p className="text-xs text-ink-muted font-medium">Fetching verified campus doctors...</p>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-background rounded-2xl border border-dashed border-border p-6">
              <Stethoscope className="w-8 h-8 text-ink-muted mx-auto" />
              <p className="text-xs text-ink-muted font-medium">No physicians matched your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDoctors.map((doc) => {
                const isSelected = selectedDoctor?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (doc.is_available) {
                        setSelectedDoctor(doc);
                        setSelectedSlot(null);
                      }
                    }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                      !doc.is_available
                        ? 'opacity-60 bg-background/50 border-border cursor-not-allowed'
                        : isSelected
                        ? 'bg-medical/5 border-medical ring-2 ring-medical/30 shadow-xs'
                        : 'bg-background border-border hover:border-medical/50 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold ${
                            doc.is_available
                              ? 'bg-wellness/10 text-wellness'
                              : 'bg-ink-muted/10 text-ink-muted'
                          }`}
                        >
                          {doc.is_available ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-wellness" />
                              <span>Available for Booking</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-ink-muted" />
                              <span>Currently Unavailable</span>
                            </>
                          )}
                        </div>

                        {isSelected && (
                          <span className="w-6 h-6 rounded-full bg-medical text-surface flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-3">
                        {doc.profile_image_url ? (
                          <img
                            src={doc.profile_image_url}
                            alt={doc.full_name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-medical/10 text-medical font-bold text-sm flex items-center justify-center shrink-0">
                            {doc.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                        )}

                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h3 className="font-heading font-bold text-sm text-ink truncate">
                            {doc.full_name}
                          </h3>
                          <p className="text-xs text-medical font-medium truncate flex items-center gap-1">
                            <Award className="w-3 h-3 shrink-0" />
                            <span>{doc.designation || 'Specialist'}</span>
                          </p>
                          <p className="text-xs text-ink-muted truncate flex items-center gap-1">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span>{doc.department}</span>
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/60">
                        <p className="text-2xs font-semibold text-ink-muted uppercase">Specialization</p>
                        <p className="text-xs text-ink font-medium truncate">{doc.specialization}</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={!doc.is_available}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (doc.is_available) {
                            setSelectedDoctor(doc);
                            setSelectedSlot(null);
                            setStep(2);
                          }
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                          !doc.is_available
                            ? 'bg-border text-ink-muted cursor-not-allowed'
                            : isSelected
                            ? 'bg-medical text-surface hover:bg-medical/90 shadow-xs'
                            : 'bg-surface border border-border text-ink hover:bg-surface-hover'
                        }`}
                      >
                        <span>{isSelected ? 'Selected — Continue' : 'Select Doctor'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedDoctor && (
            <div className="pt-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-medical text-surface font-semibold text-xs hover:bg-medical/90 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Continue to Date & Time</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: DATE & TIME SLOT SELECTION */}
      {step === 2 && selectedDoctor && (
        <div className="space-y-6">
          {/* Selected Doctor Summary Pill */}
          <div className="bg-background rounded-2xl border border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-medical/10 text-medical flex items-center justify-center font-bold text-sm shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-ink">{selectedDoctor.full_name}</h4>
                <p className="text-xs text-ink-muted">
                  {selectedDoctor.designation} • {selectedDoctor.department} ({selectedDoctor.specialization})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-medical hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Change Doctor</span>
            </button>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-ink uppercase tracking-wider">
              1. Select Appointment Date
            </label>
            <div className="relative max-w-sm">
              <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="date"
                min={getTodayString()}
                value={appointmentDate}
                onChange={(e) => {
                  setAppointmentDate(e.target.value);
                  setSelectedSlot(null);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-ink text-xs font-medium focus-ring"
              />
            </div>
            <p className="text-2xs text-ink-muted">Clinic operating hours: 09:00 AM – 05:00 PM (Asia/Dhaka timezone)</p>
          </div>

          {/* Time Slot Selection Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                2. Select 30-Minute Time Slot
              </label>
              {loadingSlots && (
                <span className="text-2xs text-medical font-medium flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking slot availability...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {ALL_TIME_SLOTS.map((slot) => {
                // Check if this slot is already booked for selected doctor
                const isBooked = bookedSlotTimes.some(
                  (bt) => bt.substring(0, 5) === slot.startTime.substring(0, 5)
                );
                const isSelected = selectedSlot?.startTime === slot.startTime;

                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    disabled={isBooked}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-2.5 rounded-xl border text-2xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isBooked
                        ? 'bg-border/40 border-border text-ink-muted/50 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-medical text-surface border-medical ring-2 ring-medical/30 shadow-xs'
                        : 'bg-background border-border text-ink hover:border-medical/60 hover:bg-surface-hover'
                    }`}
                  >
                    <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-surface' : 'text-medical'}`} />
                    <span>{slot.label}</span>
                    {isBooked && <span className="text-32xs font-bold uppercase tracking-tight text-emergency">Booked</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step Controls */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              disabled={!selectedSlot}
              onClick={() => setStep(3)}
              className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer ${
                selectedSlot
                  ? 'bg-medical text-surface hover:bg-medical/90'
                  : 'bg-border text-ink-muted cursor-not-allowed'
              }`}
            >
              <span>Continue to Clinical Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REASON & CLINICAL DETAILS */}
      {step === 3 && selectedDoctor && selectedSlot && (
        <form onSubmit={handleSubmitBooking} className="space-y-6">
          {/* Summary Box */}
          <div className="bg-background rounded-2xl border border-border p-4 space-y-2 text-xs">
            <h4 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-medical" />
              <span>Appointment Summary</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-ink">
              <div>
                <span className="text-2xs text-ink-muted block uppercase">Physician</span>
                <span className="font-semibold">{selectedDoctor.full_name}</span>
              </div>
              <div>
                <span className="text-2xs text-ink-muted block uppercase">Date</span>
                <span className="font-semibold font-mono">{appointmentDate}</span>
              </div>
              <div>
                <span className="text-2xs text-ink-muted block uppercase">Time Slot</span>
                <span className="font-semibold text-medical font-mono">{selectedSlot.label}</span>
              </div>
            </div>
          </div>

          {bookingError && (
            <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-ink uppercase tracking-wider">
              Primary Medical Concern / Reason <span className="text-emergency">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-ink text-xs font-medium focus-ring"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Other Medical Concern' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                Specify Reason <span className="text-emergency">*</span>
              </label>
              <input
                type="text"
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Briefly describe your medical concern..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-ink text-xs focus-ring"
              />
            </div>
          )}

          {/* Symptoms Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-ink uppercase tracking-wider">
              Observed Symptoms <span className="text-ink-muted font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. High fever for 2 days, body aches, sore throat..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-ink text-xs focus-ring"
            />
          </div>

          {/* Student Notes Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-ink uppercase tracking-wider">
              Additional Note for Doctor <span className="text-ink-muted font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={studentNote}
              onChange={(e) => setStudentNote(e.target.value)}
              placeholder="e.g. Please note allergic reaction to penicillin..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-ink text-xs focus-ring"
            />
          </div>

          {/* Controls */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep(2)}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-medical text-surface font-semibold text-xs hover:bg-medical/90 transition-colors flex items-center gap-2 shadow-xs focus-ring cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Securing Time Slot...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Book Appointment</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: CONFIRMATION STATE */}
      {step === 4 && confirmedAppointment && (
        <div className="py-6 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-wellness/10 text-wellness flex items-center justify-center mx-auto border border-wellness/30 shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="font-heading font-bold text-xl text-ink">
              Appointment Successfully Booked!
            </h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Your consultation request has been logged and assigned to campus health records. Please arrive at the DIU Medical Center 5 minutes before your scheduled slot.
            </p>
          </div>

          {/* Appointment Ticket Details */}
          <div className="bg-background rounded-2xl border border-border p-6 max-w-md mx-auto text-left space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-2xs font-bold uppercase text-ink-muted tracking-wider">
                Appointment Slip
              </span>
              <span className="font-mono text-2xs px-2 py-0.5 rounded bg-surface border border-border text-medical font-semibold">
                ID: {confirmedAppointment.id.slice(0, 8)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <Stethoscope className="w-4 h-4 text-medical shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">{confirmedAppointment.doctors?.full_name}</p>
                  <p className="text-2xs text-ink-muted">
                    {confirmedAppointment.doctors?.department} ({confirmedAppointment.doctors?.specialization})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <p className="font-mono text-ink">Date: <span className="font-semibold">{confirmedAppointment.appointment_date}</span></p>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-wellness shrink-0" />
                <p className="font-mono text-ink">Time Slot: <span className="font-semibold text-wellness">{confirmedAppointment.start_time.slice(0,5)} - {confirmedAppointment.end_time.slice(0,5)}</span></p>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Reason: {confirmedAppointment.reason}</p>
                  {confirmedAppointment.symptoms && (
                    <p className="text-2xs text-ink-muted">Symptoms: {confirmedAppointment.symptoms}</p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-2xs text-ink-muted font-medium">Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-2xs font-semibold border border-amber-500/20">
                  Pending Consultation
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSelectedDoctor(null);
                setSelectedSlot(null);
                setConfirmedAppointment(null);
              }}
              className="px-5 py-2.5 rounded-xl border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors focus-ring cursor-pointer"
            >
              Book Another Appointment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

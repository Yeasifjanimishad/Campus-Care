import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Search,
  Calendar,
  User as UserIcon,
  Building,
  FileText,
  Pill,
  Clock,
  Loader2,
  AlertCircle,
  ChevronRight,
  Stethoscope,
  X,
  Info,
  ShieldCheck,
  Plus,
  Edit3,
  CheckCircle2,
  Check,
  Save
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { UserProfile, HealthRecord, Appointment, Doctor } from '../types';

interface DoctorHealthRecordsProps {
  user: UserProfile;
  initialAppointmentForRecord?: Appointment | null;
  onRecordCreatedOrUpdated?: () => void;
}

export const DoctorHealthRecords: React.FC<DoctorHealthRecordsProps> = ({
                                                                          user,
                                                                          initialAppointmentForRecord,
                                                                          onRecordCreatedOrUpdated
                                                                        }) => {
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [completedAppointments, setCompletedAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);

  // Form State
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [clinicalSummary, setClinicalSummary] = useState<string>('');
  const [prescription, setPrescription] = useState<string>('');
  const [treatmentPlan, setTreatmentPlan] = useState<string>('');
  const [followUpInstructions, setFollowUpInstructions] = useState<string>('');
  const [doctorNote, setDoctorNote] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // 1. Fetch Doctor Profile, Health Records, and Completed Appointments
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Doctor Profile
      let docData: Doctor | null = null;
      try {
        if (isSupabaseConfigured) {
          const authUser = (await supabase.auth.getUser()).data.user;
          if (authUser?.id) {
            const { data } = await supabase
                .from('doctors')
                .select('*')
                .eq('user_id', authUser.id)
                .maybeSingle();
            if (data) docData = data as Doctor;
          }
        }

        if (!docData && user.email && isSupabaseConfigured) {
          const { data } = await supabase
              .from('doctors')
              .select('*')
              .ilike('email', user.email)
              .maybeSingle();
          if (data) docData = data as Doctor;
        }

        if (!docData && user.universityId && isSupabaseConfigured) {
          const { data } = await supabase
              .from('doctors')
              .select('*')
              .eq('doctor_id', user.universityId)
              .maybeSingle();
          if (data) docData = data as Doctor;
        }
      } catch (e) {
        console.warn('[DoctorHealthRecords]: Doctor profile query notice:', e);
      }

      if (!docData) {
        docData = {
          id: user.universityId || 'user-doc-id',
          full_name: user.name || 'Medical Officer',
          specialization: 'General Medicine',
          department: user.department || 'Medical Center',
          email: user.email || 'doctor@diu.edu.bd',
          phone: user.phone || '',
          designation: 'Medical Specialist',
          bio: '',
          doctor_id: user.universityId || 'DOC-UNASSIGNED',
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      setDoctorProfile(docData as Doctor);

      // Fetch Health Records created by this doctor
      let fetchedRecords: HealthRecord[] = [];
      try {
        const response = await apiFetch('/health-records?limit=100');
        if (response && response.data) {
          fetchedRecords = response.data;
        }
      } catch (err) {
        console.warn('[DoctorHealthRecords] Health records fetch notice:', err);
      }

      // Merge local storage health records
      try {
        const rawLocal = localStorage.getItem('campuscare_local_health_records');
        if (rawLocal) {
          const localRecords: HealthRecord[] = JSON.parse(rawLocal);
          const map = new Map<string, HealthRecord>();
          fetchedRecords.forEach((r) => map.set(r.id, r));
          localRecords.forEach((r) => {
            if (r.doctor_id === docData?.id || r.doctor?.email === docData?.email) {
              map.set(r.id, { ...map.get(r.id), ...r });
            }
          });
          fetchedRecords = Array.from(map.values());
        }
      } catch (e) {}

      setRecords(fetchedRecords);

      // Fetch Doctor's Completed/Confirmed Appointments for student select menu
      let fetchedApps: Appointment[] = [];
      try {
        const response = await apiFetch('/appointments?limit=100');
        if (response && response.data) {
          fetchedApps = response.data.filter((a: any) => ['confirmed', 'completed'].includes(a.status));
        }
      } catch (err) {
        console.warn('[DoctorHealthRecords] Appointments fetch notice:', err);
      }

      // Merge local storage appointments
      try {
        const rawLocalApps = localStorage.getItem('campuscare_local_appointments');
        if (rawLocalApps) {
          const localApps: Appointment[] = JSON.parse(rawLocalApps);
          const appMap = new Map<string, Appointment>();
          fetchedApps.forEach((a) => appMap.set(a.id, a));
          localApps.forEach((a) => {
            if ((a.doctor_id === docData?.id || a.doctor?.email === docData?.email) && ['confirmed', 'completed'].includes(a.status)) {
              appMap.set(a.id, { ...appMap.get(a.id), ...a });
            }
          });
          fetchedApps = Array.from(appMap.values());
        }
      } catch (e) {}

      setCompletedAppointments(fetchedApps);

    } catch (err: any) {
      console.warn('[DoctorHealthRecords] Notice loading records:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [user.email, user.universityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open modal pre-configured if initialAppointmentForRecord is passed
  useEffect(() => {
    if (initialAppointmentForRecord && doctorProfile) {
      handleOpenCreateForAppointment(initialAppointmentForRecord);
    }
  }, [initialAppointmentForRecord, doctorProfile]);

  const handleOpenCreateForAppointment = (app: Appointment) => {
    setEditingRecord(null);
    setSelectedAppointmentId(app.id);
    setSelectedStudentId(app.student_id);
    setSelectedStudentName(app.student?.name || 'Student Patient');
    setDiagnosis('');
    setClinicalSummary(app.symptoms ? `Chief complaint: ${app.symptoms}` : '');
    setPrescription('');
    setTreatmentPlan('');
    setFollowUpInstructions('');
    setDoctorNote('');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenCreateNew = () => {
    setEditingRecord(null);
    setSelectedAppointmentId('');
    setSelectedStudentId('');
    setSelectedStudentName('');
    setDiagnosis('');
    setClinicalSummary('');
    setPrescription('');
    setTreatmentPlan('');
    setFollowUpInstructions('');
    setDoctorNote('');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: HealthRecord) => {
    setEditingRecord(rec);
    setSelectedAppointmentId(rec.appointment_id || '');
    setSelectedStudentId(rec.student_id);
    setSelectedStudentName(rec.student?.name || 'Student');
    setDiagnosis(rec.diagnosis);
    setClinicalSummary(rec.clinical_summary || '');
    setPrescription(rec.prescription || '');
    setTreatmentPlan(rec.treatment_plan || '');
    setFollowUpInstructions(rec.follow_up_instructions || '');
    setDoctorNote(rec.doctor_note || '');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleAppointmentSelectChange = (appId: string) => {
    setSelectedAppointmentId(appId);
    const app = completedAppointments.find(a => a.id === appId);
    if (app) {
      setSelectedStudentId(app.student_id);
      setSelectedStudentName(app.student?.name || 'Student Patient');
      if (app.symptoms && !clinicalSummary) {
        setClinicalSummary(`Chief complaint: ${app.symptoms}`);
      }
    } else {
      setSelectedStudentId('');
      setSelectedStudentName('');
    }
  };

  const handleSaveHealthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!diagnosis.trim()) {
      setFormError('Clinical diagnosis is required.');
      return;
    }

    if (!editingRecord && !selectedStudentId) {
      setFormError('Please select a student appointment consultation.');
      return;
    }

    try {
      setSaving(true);

      if (editingRecord) {
        // UPDATE existing record via backend API
        const response = await apiFetch(`/health-records/${editingRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            diagnosis: diagnosis.trim(),
            clinical_summary: clinicalSummary.trim() || null,
            prescription: prescription.trim() || null,
            treatment_plan: treatmentPlan.trim() || null,
            follow_up_instructions: followUpInstructions.trim() || null,
            doctor_note: doctorNote.trim() || null
          })
        });

        if (response && response.id) {
          setFormSuccess('Health record updated successfully.');
          setTimeout(() => {
            setIsModalOpen(false);
            fetchData();
            if (onRecordCreatedOrUpdated) onRecordCreatedOrUpdated();
          }, 800);
        } else {
          setFormError('Failed to update record.');
        }

      } else {
        // CREATE new record via backend API
        const response = await apiFetch('/health-records', {
          method: 'POST',
          body: JSON.stringify({
            student_id: selectedStudentId,
            appointment_id: selectedAppointmentId || null,
            diagnosis: diagnosis.trim(),
            clinical_summary: clinicalSummary.trim() || null,
            prescription: prescription.trim() || null,
            treatment_plan: treatmentPlan.trim() || null,
            follow_up_instructions: followUpInstructions.trim() || null,
            doctor_note: doctorNote.trim() || null
          })
        });

        if (response && response.id) {
          setFormSuccess('Health record created successfully!');
          setTimeout(() => {
            setIsModalOpen(false);
            fetchData();
            if (onRecordCreatedOrUpdated) onRecordCreatedOrUpdated();
          }, 800);
        } else {
          setFormError('Failed to create record.');
        }
      }
    } catch (err: any) {
      console.error('Error saving health record:', err);
      setFormError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Records
  const filteredRecords = records.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const studentName = r.student?.name?.toLowerCase() || '';
    const studentId = r.student?.university_id?.toLowerCase() || '';
    const diag = r.diagnosis.toLowerCase();
    const rx = r.prescription?.toLowerCase() || '';
    return studentName.includes(q) || studentId.includes(q) || diag.includes(q) || rx.includes(q);
  });

  const formatDatePretty = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-ink">Clinical Patient Health Records</h2>
              </div>
              <p className="text-xs text-ink-muted">
                Create and manage official medical diagnoses, clinical notes, and prescriptions for campus students you consult.
              </p>
            </div>

            <button
                type="button"
                onClick={handleOpenCreateNew}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-contrast hover:bg-primary-hover font-semibold text-xs transition-colors shrink-0 shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Health Record</span>
            </button>
          </div>

          {error && (
              <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-emergency shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
          )}

          {/* Search Bar */}
          <div className="relative pt-2">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
                type="text"
                placeholder="Search patient name, ID, diagnosis, or prescription..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Patient Health Records List */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Patient Health Records ({filteredRecords.length})
            </h3>
            <span className="text-2xs text-ink-muted font-mono">Verified Treating Physician Access</span>
          </div>

          {loading ? (
              <div className="py-12 text-center text-ink-muted space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-xs">Loading patient health records...</p>
              </div>
          ) : filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-ink-muted space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-hover mx-auto flex items-center justify-center text-ink-muted">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium">No patient health records issued yet.</p>
                <p className="text-2xs text-ink-muted max-w-sm mx-auto">
                  Click &quot;Create Health Record&quot; above or choose a completed appointment to document a patient diagnosis and prescription.
                </p>
              </div>
          ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredRecords.map((record) => {
                  const studentName = record.student?.name || 'Student Patient';
                  const studentUniId = record.student?.university_id || 'N/A';
                  const studentDept = record.student?.department || 'University Student';

                  return (
                      <div
                          key={record.id}
                          className="rounded-2xl border border-border p-5 bg-surface space-y-4 shadow-2xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
                          <CheckCircle2 className="w-3 h-3" /> Signed Record
                        </span>
                              <span className="text-2xs text-ink-muted font-mono">
                          {formatDatePretty(record.created_at)}
                        </span>
                            </div>

                            <h4 className="text-base font-bold text-ink">
                              Diagnosis: {record.diagnosis}
                            </h4>
                          </div>

                          <button
                              type="button"
                              onClick={() => handleOpenEdit(record)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-hover border border-border hover:bg-border/30 text-ink text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-primary" />
                            <span>Edit Clinical Notes</span>
                          </button>
                        </div>

                        {/* Patient Info Row */}
                        <div className="p-3.5 rounded-xl bg-surface-hover border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {studentName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-ink">{studentName}</p>
                              <p className="text-2xs text-ink-muted">ID: {studentUniId} • {studentDept}</p>
                            </div>
                          </div>

                          {record.appointment && (
                              <div className="text-2xs text-ink-muted font-mono bg-surface px-2.5 py-1 rounded-lg border border-border/80">
                                Consultation Date: {record.appointment.appointment_date}
                              </div>
                          )}
                        </div>

                        {/* Clinical Sections */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {record.clinical_summary && (
                              <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                <span className="text-2xs font-bold text-ink-muted uppercase tracking-wider block">Clinical Summary</span>
                                <p className="text-ink whitespace-pre-wrap">{record.clinical_summary}</p>
                              </div>
                          )}

                          {record.prescription && (
                              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                        <span className="text-2xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                          <Pill className="w-3.5 h-3.5" /> Prescribed Medications
                        </span>
                                <p className="text-ink font-mono whitespace-pre-wrap">{record.prescription}</p>
                              </div>
                          )}

                          {record.treatment_plan && (
                              <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                <span className="text-2xs font-bold text-ink-muted uppercase tracking-wider block">Treatment Plan</span>
                                <p className="text-ink whitespace-pre-wrap">{record.treatment_plan}</p>
                              </div>
                          )}

                          {record.follow_up_instructions && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                                <span className="text-2xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Follow-Up Instructions</span>
                                <p className="text-ink whitespace-pre-wrap">{record.follow_up_instructions}</p>
                              </div>
                          )}
                        </div>
                      </div>
                  );
                })}
              </div>
          )}
        </div>

        {/* Create / Edit Health Record Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-border pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-ink text-base">
                        {editingRecord ? 'Edit Patient Health Record' : 'Create Patient Health Record'}
                      </h3>
                    </div>
                    <p className="text-2xs text-ink-muted">
                      {editingRecord
                          ? `Updating diagnosis and clinical notes for ${selectedStudentName}`
                          : 'Document official clinical findings, diagnosis, and prescription.'}
                    </p>
                  </div>

                  <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {formError && (
                    <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                )}

                {formSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{formSuccess}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSaveHealthRecord} className="space-y-4 text-xs">
                  {/* Select Consultation / Appointment if creating new */}
                  {!editingRecord ? (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-ink">
                          Select Patient Consultation / Appointment <span className="text-emergency">*</span>
                        </label>
                        <select
                            value={selectedAppointmentId}
                            onChange={(e) => handleAppointmentSelectChange(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            required
                        >
                          <option value="">-- Choose a student consultation --</option>
                          {completedAppointments.map(app => (
                              <option key={app.id} value={app.id}>
                                {app.student?.name || 'Student'} ({app.student?.university_id || 'ID'}) — {app.appointment_date} ({app.reason})
                              </option>
                          ))}
                        </select>
                        <p className="text-2xs text-ink-muted">
                          Health records require a valid medical relationship derived from a student appointment.
                        </p>
                      </div>
                  ) : (
                      <div className="p-3 rounded-xl bg-surface-hover border border-border space-y-0.5">
                        <span className="text-2xs font-bold text-ink-muted uppercase">Patient</span>
                        <p className="font-bold text-ink">{selectedStudentName}</p>
                      </div>
                  )}

                  {/* Primary Diagnosis */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink">
                      Primary Clinical Diagnosis <span className="text-emergency">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="e.g. Acute Viral Bronchitis, Migraine, Tension Headache, Sprained Ankle"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-semibold"
                    />
                  </div>

                  {/* Clinical Summary */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink">
                      Clinical Summary & Examination Findings
                    </label>
                    <textarea
                        rows={3}
                        placeholder="Document physical findings, vital signs, patient symptoms, and clinical assessment..."
                        value={clinicalSummary}
                        onChange={(e) => setClinicalSummary(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Prescription / Medications */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-primary flex items-center gap-1">
                      <Pill className="w-3.5 h-3.5" /> Prescribed Medications & Dosage
                    </label>
                    <textarea
                        rows={3}
                        placeholder="e.g. Tab. Paracetamol 500mg - 1+1+1 after meal for 5 days&#10;Cap. Amoxicillin 500mg - 1+0+1 for 7 days"
                        value={prescription}
                        onChange={(e) => setPrescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono text-xs"
                    />
                  </div>

                  {/* Treatment Plan */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink">
                      Treatment Plan & Recommendations
                    </label>
                    <textarea
                        rows={2}
                        placeholder="e.g. Bed rest for 3 days, drink plenty of warm fluids, apply cold compress..."
                        value={treatmentPlan}
                        onChange={(e) => setTreatmentPlan(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Follow-up Instructions */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400">
                      Follow-Up Instructions
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Re-evaluation in 7 days or sooner if symptoms worsen"
                        value={followUpInstructions}
                        onChange={(e) => setFollowUpInstructions(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Doctor Private Note */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink">
                      Doctor Notes
                    </label>
                    <input
                        type="text"
                        placeholder="Additional observations or internal consultation notes"
                        value={doctorNote}
                        onChange={(e) => setDoctorNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 rounded-xl border border-border bg-surface text-ink hover:bg-surface-hover font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-contrast hover:bg-primary-hover font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                      ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>{editingRecord ? 'Update Record' : 'Save & Publish Record'}</span>
                          </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
};

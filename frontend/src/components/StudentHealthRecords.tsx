import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Search, 
  Calendar, 
  User as UserIcon, 
  Building, 
  FileText, 
  Pill, 
  ClipboardList, 
  Clock, 
  Loader2, 
  AlertCircle, 
  ChevronRight, 
  Stethoscope, 
  X, 
  Info, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, HealthRecord } from '../types';
import { apiFetch } from '../lib/api';

interface StudentHealthRecordsProps {
  user: UserProfile;
  initialSelectedRecordId?: string | null;
}

export const StudentHealthRecords: React.FC<StudentHealthRecordsProps> = ({ 
  user, 
  initialSelectedRecordId 
}) => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Record Modal State
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);

  const fetchHealthRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let fetchedRecords: HealthRecord[] = [];

      try {
        const response = await apiFetch('/health-records');
        if (response && response.data) {
          fetchedRecords = response.data;
        }
      } catch (err: any) {
        console.warn('Notice loading health records from backend:', err?.message || err);
      }

      setRecords(fetchedRecords);

      if (initialSelectedRecordId && fetchedRecords.length > 0) {
        const match = fetchedRecords.find(r => r.id === initialSelectedRecordId || r.appointment_id === initialSelectedRecordId);
        if (match) setSelectedRecord(match);
      }
    } catch (err: any) {
      console.error('Error in fetchHealthRecords:', err);
      setError(err.message || 'An error occurred loading your health records.');
    } finally {
      setLoading(false);
    }
  }, [initialSelectedRecordId]);

  useEffect(() => {
    fetchHealthRecords();
  }, [fetchHealthRecords]);

  // Filtered Records
  const filteredRecords = records.filter(record => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    const diagnosisMatch = record.diagnosis.toLowerCase().includes(q);
    const summaryMatch = record.clinical_summary?.toLowerCase().includes(q) || false;
    const prescriptionMatch = record.prescription?.toLowerCase().includes(q) || false;
    const doctorNameMatch = record.doctor?.full_name.toLowerCase().includes(q) || false;
    const doctorDeptMatch = record.doctor?.department.toLowerCase().includes(q) || false;

    return diagnosisMatch || summaryMatch || prescriptionMatch || doctorNameMatch || doctorDeptMatch;
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
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-ink">Personal Health & Clinical Records</h2>
            </div>
            <p className="text-xs text-ink-muted">
              Confidential, read-only consultation summaries, diagnoses, and prescriptions recorded by authorized campus medical staff.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold shrink-0">
            <ShieldCheck className="w-4 h-4" />
            <span>HIPAA / FERPA Protected</span>
          </div>
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
            placeholder="Search by diagnosis, doctor name, prescription, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Health Records List */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Medical History ({filteredRecords.length})
          </h3>
          <span className="text-2xs text-ink-muted">Read-Only Student Access</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-ink-muted space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs">Loading health records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-ink-muted space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-hover mx-auto flex items-center justify-center text-ink-muted">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium">No medical health records found.</p>
            <p className="text-2xs text-ink-muted max-w-sm mx-auto">
              After you complete a medical consultation with a campus doctor, your clinical diagnosis and prescription will be safely published here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRecords.map((record) => {
              const doctorName = record.doctor?.full_name || 'Campus Physician';
              const doctorDept = record.doctor?.department || 'Medical Center';
              const doctorSpec = record.doctor?.specialization || 'General Practitioner';

              return (
                <div
                  key={record.id}
                  className="rounded-2xl border border-border p-5 bg-surface hover:border-primary/50 transition-all space-y-4 shadow-2xs cursor-pointer group"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
                          <CheckCircle2 className="w-3 h-3" /> Certified Record
                        </span>
                        <span className="text-2xs text-ink-muted font-mono">
                          Date: {formatDatePretty(record.created_at)}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-ink group-hover:text-primary transition-colors">
                        Diagnosis: {record.diagnosis}
                      </h4>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0"
                    >
                      <span>View Record</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Doctor Info Row */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted bg-surface-hover p-3 rounded-xl border border-border">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold text-ink">{doctorName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-2xs font-mono">
                      <Building className="w-3 h-3 text-ink-muted" />
                      <span>{doctorDept} ({doctorSpec})</span>
                    </div>
                  </div>

                  {/* Quick Snippets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {record.clinical_summary && (
                      <div className="p-2.5 rounded-xl bg-surface border border-border/80 space-y-0.5">
                        <span className="text-2xs font-bold text-ink-muted uppercase">Summary</span>
                        <p className="text-xs text-ink line-clamp-2">{record.clinical_summary}</p>
                      </div>
                    )}

                    {record.prescription && (
                      <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-0.5">
                        <span className="text-2xs font-bold text-primary uppercase flex items-center gap-1">
                          <Pill className="w-3 h-3" /> Prescription
                        </span>
                        <p className="text-xs text-ink line-clamp-2">{record.prescription}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Read-Only Record Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-ink text-base">Clinical Health Record Details</h3>
                </div>
                <p className="text-2xs text-ink-muted">
                  Recorded on {formatDatePretty(selectedRecord.created_at)} by {selectedRecord.doctor?.full_name || 'Campus Physician'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Doctor & Patient Context */}
            <div className="p-4 rounded-xl bg-surface-hover border border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-2xs uppercase font-bold text-ink-muted tracking-wider block">Treating Physician</span>
                <p className="font-bold text-ink">{selectedRecord.doctor?.full_name || 'Campus Doctor'}</p>
                <p className="text-2xs text-ink-muted">{selectedRecord.doctor?.designation || 'Consultant Physician'}</p>
                <p className="text-2xs text-ink-muted">{selectedRecord.doctor?.department} • {selectedRecord.doctor?.specialization}</p>
              </div>

              <div>
                <span className="text-2xs uppercase font-bold text-ink-muted tracking-wider block">Patient Record</span>
                <p className="font-bold text-ink">{user.name}</p>
                <p className="text-2xs text-ink-muted">University ID: {user.universityId}</p>
                {selectedRecord.appointment && (
                  <p className="text-2xs text-primary font-mono mt-1">
                    Consultation: {selectedRecord.appointment.appointment_date}
                  </p>
                )}
              </div>
            </div>

            {/* Clinical Content Sections */}
            <div className="space-y-4 text-xs">
              {/* Diagnosis */}
              <div className="space-y-1 p-3.5 rounded-xl bg-surface border border-border">
                <span className="text-2xs font-bold text-ink-muted uppercase tracking-wider block">Primary Diagnosis</span>
                <p className="font-bold text-sm text-ink">{selectedRecord.diagnosis}</p>
              </div>

              {/* Clinical Summary */}
              {selectedRecord.clinical_summary && (
                <div className="space-y-1 p-3.5 rounded-xl bg-surface border border-border">
                  <span className="text-2xs font-bold text-ink-muted uppercase tracking-wider block">Clinical Summary & Consultation Notes</span>
                  <p className="text-ink leading-relaxed whitespace-pre-wrap">{selectedRecord.clinical_summary}</p>
                </div>
              )}

              {/* Prescription / Treatment */}
              {selectedRecord.prescription && (
                <div className="space-y-1 p-3.5 rounded-xl bg-primary/5 border border-primary/20">
                  <span className="text-2xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                    <Pill className="w-3.5 h-3.5" /> Prescribed Medications / Dosage
                  </span>
                  <p className="text-ink font-mono text-xs leading-relaxed whitespace-pre-wrap">{selectedRecord.prescription}</p>
                </div>
              )}

              {/* Treatment Plan */}
              {selectedRecord.treatment_plan && (
                <div className="space-y-1 p-3.5 rounded-xl bg-surface border border-border">
                  <span className="text-2xs font-bold text-ink-muted uppercase tracking-wider block">Treatment Plan</span>
                  <p className="text-ink leading-relaxed whitespace-pre-wrap">{selectedRecord.treatment_plan}</p>
                </div>
              )}

              {/* Follow-up Instructions */}
              {selectedRecord.follow_up_instructions && (
                <div className="space-y-1 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-2xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Follow-Up Instructions
                  </span>
                  <p className="text-ink leading-relaxed whitespace-pre-wrap">{selectedRecord.follow_up_instructions}</p>
                </div>
              )}

              {/* Doctor Note */}
              {selectedRecord.doctor_note && (
                <div className="space-y-1 p-3.5 rounded-xl bg-surface border border-border">
                  <span className="text-2xs font-bold text-ink-muted uppercase tracking-wider block">Additional Doctor Notes</span>
                  <p className="text-ink leading-relaxed whitespace-pre-wrap">{selectedRecord.doctor_note}</p>
                </div>
              )}
            </div>

            {/* Footer Notice */}
            <div className="pt-3 border-t border-border flex items-center justify-between text-2xs text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Immutable Patient Record
              </span>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-contrast hover:bg-primary-hover font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

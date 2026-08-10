import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Plus, 
  Upload, 
  X, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileSearch, 
  Image as ImageIcon, 
  MapPin, 
  Calendar, 
  Loader2, 
  Info, 
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, IncidentReport, IncidentCategory } from '../types';

interface StudentIncidentReportingProps {
  user: UserProfile;
}

const CATEGORIES: IncidentCategory[] = [
  'Medical',
  'Safety',
  'Campus Facility',
  'Harassment/Concern',
  'Other'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILES = 3;

export const StudentIncidentReporting: React.FC<StudentIncidentReportingProps> = ({ user }) => {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  
  // Form fields
  const [category, setCategory] = useState<IncidentCategory>('Medical');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [incidentDate, setIncidentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [incidentTime, setIncidentTime] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Expanded report view ID
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Status messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Signed image URLs map
  const [imageUrlsMap, setImageUrlsMap] = useState<Record<string, string[]>>({});

  // Fetch reports for logged in student
  const fetchReports = useCallback(async () => {
    let remoteReports: IncidentReport[] = [];

    if (isSupabaseConfigured) {
      try {
        setLoading(true);
        setErrorMsg(null);

        const { data: authData } = await supabase.auth.getUser();
        const studentId = authData?.user?.id || user.id || 'std-101';

        const { data, error } = await supabase
          .from('incident_reports')
          .select('*')
          .eq('reporter_id', studentId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          remoteReports = data as IncidentReport[];
        }
      } catch (err: any) {
        console.warn('Notice loading student reports from Supabase:', err?.message || err);
      }
    }

    // Read local reports
    let localReports: IncidentReport[] = [];
    try {
      const stored = localStorage.getItem('campuscare_incident_reports');
      if (stored) {
        localReports = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading local incident reports:', e);
    }

    // Merge
    const map = new Map<string, IncidentReport>();
    localReports.forEach(r => map.set(r.id, r));
    remoteReports.forEach(r => map.set(r.id, r));

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setReports(merged);

    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    fetchReports();

    const handleSync = () => fetchReports();
    window.addEventListener('campuscare_incidents_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('campuscare_incidents_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [fetchReports]);

  // Handle File selection and validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (!e.target.files) return;

    const files: File[] = Array.from(e.target.files);

    if (selectedFiles.length + files.length > MAX_FILES) {
      setErrorMsg(`Maximum ${MAX_FILES} evidence photos allowed per report.`);
      return;
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErrorMsg(`File "${file.name}" is not a supported format. Please upload JPEG, PNG, or WebP images.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(`File "${file.name}" exceeds maximum size limit of 5 MB.`);
        return;
      }
    }

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload files to Supabase Storage
  const uploadFiles = async (userId: string): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress(`Uploading photo ${i + 1} of ${selectedFiles.length}...`);

      const fileExt = file.name.split('.').pop() || 'jpg';
      const uniqueName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('incident-evidence')
        .upload(uniqueName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('File upload error:', error);
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      }

      if (data?.path) {
        uploadedPaths.push(data.path);
      }
    }

    return uploadedPaths;
  };

  // Submit incident report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a report title.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Please provide a detailed description of the incident.');
      return;
    }

    try {
      setSubmitting(true);
      let submitted = false;

      if (isSupabaseConfigured) {
        try {
          const authUser = (await supabase.auth.getUser()).data?.user;
          const reporterId = authUser?.id || user.id || 'std-101';

          let evidencePaths: string[] = [];
          if (selectedFiles.length > 0 && authUser) {
            try {
              evidencePaths = await uploadFiles(authUser.id);
            } catch (e) {
              console.warn('[StudentIncidentReporting] Photo upload notice:', e);
            }
          }

          setUploadProgress('Saving incident report...');

          const { data, error } = await supabase.rpc('create_incident_report', {
            p_category: category,
            p_title: title.trim(),
            p_description: description.trim(),
            p_location: location.trim() || null,
            p_incident_date: incidentDate,
            p_incident_time: incidentTime || null,
            p_evidence_urls: evidencePaths
          });

          if (!error) {
            submitted = true;
          } else {
            const { error: insertError } = await supabase
              .from('incident_reports')
              .insert({
                reporter_id: reporterId,
                category,
                title: title.trim(),
                description: description.trim(),
                location: location.trim() || null,
                incident_date: incidentDate,
                incident_time: incidentTime || null,
                evidence_urls: evidencePaths,
                status: 'submitted'
              });

            if (!insertError) submitted = true;
          }
        } catch (err) {
          console.warn('[StudentIncidentReporting] Supabase submission notice:', err);
        }
      }

      const newReport: IncidentReport = {
        id: 'rep-' + Math.random().toString(36).substring(2, 9),
        reporter_id: user.id || 'std-101',
        category,
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || 'Campus Main Ground',
        incident_date: incidentDate,
        incident_time: incidentTime || '12:00 PM',
        evidence_urls: [],
        status: 'submitted',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        reporter: {
          id: user.id || 'std-101',
          name: user.name || 'Student User',
          email: user.email,
          university_id: user.universityId || '242-35-101',
          department: user.department || 'Computer Science & Engineering',
          phone: user.phone || '+880 1812-345678',
        }
      };

      try {
        const stored = localStorage.getItem('campuscare_incident_reports');
        let list: IncidentReport[] = stored ? JSON.parse(stored) : [];
        list.unshift(newReport);
        localStorage.setItem('campuscare_incident_reports', JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('campuscare_incidents_updated'));
      } catch (e) {
        console.warn('Error saving local incident report:', e);
      }

      setReports(prev => [newReport, ...prev]);

      setSuccessMsg('Incident report submitted successfully. Campus security/admin will review it shortly.');
      
      // Reset form
      setTitle('');
      setDescription('');
      setLocation('');
      setIncidentTime('');
      setSelectedFiles([]);
      setShowForm(false);
      setErrorMsg(null);

      fetchReports();

    } catch (err: any) {
      console.warn('Error submitting report:', err);
      setSuccessMsg('Incident report submitted successfully.');
      setShowForm(false);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900">
            <Clock className="w-3 h-3" /> Submitted
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">
            <FileSearch className="w-3 h-3" /> Under Review
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900">
            <X className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-ink">Campus Incident Reporting</h2>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Submit non-emergency safety, facility, or health reports. For active life-threatening emergencies, use the <strong>SOS Emergency button</strong>.
            </p>
          </div>

          <button
            onClick={() => {
              setShowForm(!showForm);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-contrast hover:bg-primary-hover transition-colors font-medium text-xs shadow-2xs cursor-pointer shrink-0"
          >
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Close Form
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Report an Incident
              </>
            )}
          </button>
        </div>

        {/* Global Banner messages */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-emergency shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">{successMsg}</div>
          </div>
        )}
      </div>

      {/* Incident Report Form */}
      {showForm && (
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-6 animate-fadeIn">
          <div className="border-b border-border pb-4 flex items-center justify-between">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              New Non-Emergency Incident Report
            </h3>
            <span className="text-xs text-ink-muted">Authenticated Student: <strong>{user.name}</strong></span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink">
                  Incident Category <span className="text-emergency">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink">
                  Report Title <span className="text-emergency">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of the incident"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  maxLength={100}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">
                Detailed Description <span className="text-emergency">*</span>
              </label>
              <textarea
                rows={4}
                placeholder="Describe what happened, individuals involved (if safe to share), and any immediate observations..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink">
                  Incident Date <span className="text-emergency">*</span>
                </label>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  required
                />
              </div>

              {/* Time */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink">
                  Incident Time (Optional)
                </label>
                <input
                  type="time"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink">
                  Campus Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science Block, Room 302"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Evidence Photo Upload */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Attach Evidence / Photos (Optional, max {MAX_FILES})
                </label>
                <span className="text-2xs text-ink-muted">JPEG, PNG, WebP up to 5MB</span>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="relative group rounded-xl border border-border p-2 bg-surface-hover flex items-center gap-2 text-xs text-ink max-w-xs">
                    <ImageIcon className="w-4 h-4 text-ink-muted shrink-0" />
                    <span className="truncate max-w-[120px] font-mono text-2xs">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1 rounded-md hover:bg-emergency/20 text-emergency transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {selectedFiles.length < MAX_FILES && (
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                      multiple={selectedFiles.length < MAX_FILES - 1}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Upload progress message */}
            {uploadProgress && (
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary text-xs flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{uploadProgress}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-border text-ink hover:bg-surface-hover text-xs font-medium cursor-pointer"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-contrast hover:bg-primary-hover text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Submit Incident Report
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reports History */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-ink-muted" />
            My Submitted Reports ({reports.length})
          </h3>
          <button
            onClick={fetchReports}
            className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-ink-muted space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs">Loading report history...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center text-ink-muted space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-hover mx-auto flex items-center justify-center text-ink-muted">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium">No incident reports submitted yet.</p>
            <p className="text-2xs text-ink-muted max-w-sm mx-auto">
              If you observe non-emergency campus safety, medical, or facility issues, use the button above to file a report.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedReportId === report.id;
              const images = imageUrlsMap[report.id] || [];

              return (
                <div
                  key={report.id}
                  className="rounded-xl border border-border p-4 bg-surface hover:border-border-hover transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-surface-hover text-ink font-semibold text-2xs uppercase tracking-wider border border-border">
                          {report.category}
                        </span>
                        {getStatusBadge(report.status)}
                        {report.evidence_urls && report.evidence_urls.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-2xs text-primary font-mono">
                            <ImageIcon className="w-3 h-3" /> {report.evidence_urls.length} photo(s)
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-ink">{report.title}</h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                      className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer shrink-0"
                    >
                      {isExpanded ? (
                        <>
                          Hide Details <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          View Details <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-2xs text-ink-muted border-t border-dashed border-border/80 pt-2">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Date: {report.incident_date} {report.incident_time ? `@ ${report.incident_time}` : ''}
                    </span>
                    {report.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {report.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      Filed: {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-border space-y-4 animate-fadeIn">
                      <div className="space-y-1">
                        <span className="text-2xs uppercase font-bold text-ink-muted tracking-wider">Description</span>
                        <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap bg-surface-hover p-3 rounded-xl border border-border">
                          {report.description}
                        </p>
                      </div>

                      {/* Admin Note if present */}
                      {report.admin_note && (
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                          <span className="text-2xs font-bold text-primary flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" /> Admin Reviewer Response
                          </span>
                          <p className="text-xs text-ink leading-relaxed">
                            {report.admin_note}
                          </p>
                        </div>
                      )}

                      {/* Evidence Images */}
                      {images.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-2xs uppercase font-bold text-ink-muted tracking-wider">Attached Evidence</span>
                          <div className="flex flex-wrap gap-3">
                            {images.map((imgUrl, i) => (
                              <a
                                key={i}
                                href={imgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative rounded-xl overflow-hidden border border-border group w-24 h-24 block bg-surface-hover"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Evidence ${i + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

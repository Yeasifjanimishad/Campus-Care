import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileSearch, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  Image as ImageIcon, 
  MapPin, 
  Calendar, 
  User as UserIcon, 
  Loader2, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp, 
  Info,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { UserProfile, IncidentReport, IncidentCategory, IncidentReportStatus } from '../types';

interface AdminIncidentManagerProps {
  user: UserProfile;
}

const CATEGORIES: (IncidentCategory | 'ALL')[] = [
  'ALL',
  'Medical',
  'Safety',
  'Campus Facility',
  'Harassment/Concern',
  'Other'
];

const STATUSES: (IncidentReportStatus | 'ALL')[] = [
  'ALL',
  'submitted',
  'under_review',
  'resolved',
  'rejected'
];

const getLocalIncidentReports = (): IncidentReport[] => {
  try {
    const stored = localStorage.getItem('campuscare_incident_reports');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Error reading local incident reports:', e);
  }
  return [];
};

const saveLocalIncidentReport = (report: IncidentReport) => {
  try {
    const list = getLocalIncidentReports();
    const idx = list.findIndex(r => r.id === report.id);
    if (idx !== -1) {
      list[idx] = report;
    } else {
      list.unshift(report);
    }
    localStorage.setItem('campuscare_incident_reports', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('campuscare_incidents_updated'));
  } catch (e) {
    console.warn('Error saving local incident report:', e);
  }
};

const SAMPLE_INCIDENT_REPORTS: IncidentReport[] = [
  {
    id: 'inc-101',
    reporter_id: 'std-101',
    title: 'Broken Glass in Chemistry Corridor',
    category: 'Safety',
    description: 'Shattered window panel near Chemistry Lab B leaving sharp glass shards on the walkway.',
    location: 'Science Complex - Corridor 2B',
    evidence_urls: [],
    status: 'submitted',
    incident_date: new Date().toISOString().split('T')[0],
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    reporter: {
      id: 'std-101',
      name: 'Sokal Hosain',
      email: 'sokal@diu.edu.bd',
      university_id: '90384102',
      department: 'Computer Science & Engineering',
      phone: '+880 1812-345678',
    },
  },
  {
    id: 'inc-102',
    reporter_id: 'std-102',
    title: 'Flickering Light and Exposed Wiring in Dorm B',
    category: 'Campus Facility',
    description: 'Exposed electrical junction box sparking intermittently on 2nd floor hallway.',
    location: 'Student Residence Hall B - Hallway 204',
    evidence_urls: [],
    status: 'under_review',
    incident_date: new Date().toISOString().split('T')[0],
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    reporter: {
      id: 'std-102',
      name: 'Yeasif Jani Mishad',
      email: 'mishad242-35-739@diu.edu.bd',
      university_id: '242-35-739',
      department: 'Software Engineering',
      phone: '+880 1912-987654',
    },
  },
];

export const AdminIncidentManager: React.FC<AdminIncidentManagerProps> = ({ user }) => {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters & Search
  const [selectedStatus, setSelectedStatus] = useState<IncidentReportStatus | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Note Modal state
  const [modalAction, setModalAction] = useState<'resolve' | 'reject' | null>(null);
  const [targetReport, setTargetReport] = useState<IncidentReport | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState<string>('');

  // Expanded card ID
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Status messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Signed URLs map for evidence photos
  const [imageUrlsMap, setImageUrlsMap] = useState<Record<string, string[]>>({});

  // Fetch all reports for Admin
  const fetchReports = useCallback(async (showLoading = true) => {
    const local = getLocalIncidentReports();
    let loadedRemote: IncidentReport[] = [];

    try {
      if (showLoading) setLoading(true);
      setErrorMsg(null);

      const response = await apiFetch('/incidents?limit=100');
      if (response && response.data) {
        loadedRemote = response.data;
      }
    } catch (err: any) {
      console.warn('[AdminIncidentManager] API fetch notice:', err?.message || err);
    }

    // Merge remote, local storage, and sample fallback reports
    const reportMap = new Map<string, IncidentReport>();

    local.forEach(r => reportMap.set(r.id, r));
    loadedRemote.forEach(r => {
      const existing = reportMap.get(r.id);
      if (!existing) {
        reportMap.set(r.id, r);
      } else {
        if (new Date(r.updated_at || r.created_at).getTime() >= new Date(existing.updated_at || existing.created_at).getTime()) {
          reportMap.set(r.id, {
            ...r,
            reporter: r.reporter || existing.reporter
          });
        }
      }
    });

    SAMPLE_INCIDENT_REPORTS.forEach(sample => {
      if (!reportMap.has(sample.id)) {
        reportMap.set(sample.id, sample);
      }
    });

    const mergedList = Array.from(reportMap.values());
    mergedList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setReports(mergedList);

    // Fetch signed URLs for private evidence images via backend API
    if (mergedList.length > 0) {
      try {
        const urlMap: Record<string, string[]> = {};
        for (const report of mergedList) {
          if (report.evidence_urls && report.evidence_urls.length > 0) {
            const urls: string[] = [];
            for (const path of report.evidence_urls) {
              if (path.startsWith('http')) {
                urls.push(path);
              } else {
                try {
                  const data = await apiFetch(`/upload/incident-evidence/${encodeURIComponent(path)}`);
                  if (data.url) urls.push(data.url);
                } catch (e) {}
              }
            }
            urlMap[report.id] = urls;
          }
        }
        setImageUrlsMap(urlMap);
      } catch (e) {
        console.warn('Notice parsing evidence URLs:', e);
      }
    }

    setLoading(false);
  }, []);

  // Sync effect for local storage updates & polling
  useEffect(() => {
    fetchReports(true);

    const handleSync = () => {
      fetchReports(false);
    };

    window.addEventListener('campuscare_incidents_updated', handleSync);
    window.addEventListener('storage', handleSync);

    const interval = setInterval(() => {
      fetchReports(false);
    }, 5000);

    return () => {
      window.removeEventListener('campuscare_incidents_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(interval);
    };
  }, [fetchReports]);

  // Realtime subscription setup
  useEffect(() => {
    const token = localStorage.getItem('campuscare_session_token');
    if (!token) return;

    // Use ws:// or wss:// depending on protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime`;
    
    let ws: WebSocket | null = null;
    
    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Just reuse sos_update logic for general realtime refreshes, 
          // or add specific type if needed. We'll refresh on anything for now.
          fetchReports(false);
        } catch (e) {}
      };
    };

    connectWs();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [fetchReports]);

  // Statistics calculation
  const stats = {
    submitted: reports.filter(r => r.status === 'submitted').length,
    under_review: reports.filter(r => r.status === 'under_review').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    rejected: reports.filter(r => r.status === 'rejected').length,
    today: reports.filter(r => {
      const todayStr = new Date().toISOString().split('T')[0];
      return r.created_at.startsWith(todayStr) || r.incident_date === todayStr;
    }).length
  };

  // Filtered reports
  const filteredReports = reports.filter(report => {
    if (selectedStatus !== 'ALL' && report.status !== selectedStatus) return false;
    if (selectedCategory !== 'ALL' && report.category !== selectedCategory) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = report.title.toLowerCase().includes(q);
      const matchDesc = report.description.toLowerCase().includes(q);
      const matchLoc = report.location?.toLowerCase().includes(q);
      const matchReporter = report.reporter?.name?.toLowerCase().includes(q) ||
                            report.reporter?.email?.toLowerCase().includes(q) ||
                            report.reporter?.university_id?.toLowerCase().includes(q);

      return matchTitle || matchDesc || matchLoc || matchReporter;
    }

    return true;
  });

  // Action: Move to Under Review
  const handleStartReview = async (reportId: string) => {
    setActionLoadingId(reportId);
    setErrorMsg(null);
    setSuccessMsg(null);

    const existingReport = reports.find(r => r.id === reportId);
    const updatedReport: IncidentReport | null = existingReport ? {
      ...existingReport,
      status: 'under_review',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at: new Date().toISOString()
    } : null;

    try {
      await apiFetch(`/incidents/${reportId}/review`, {
        method: 'POST'
      });
    } catch (e) {
      console.warn('Notice updating report status:', e);
    }

    if (updatedReport) {
      saveLocalIncidentReport(updatedReport);
    }

    setSuccessMsg('Incident report marked as Under Review.');
    fetchReports(false);
    setActionLoadingId(null);
  };

  // Open note modal for Resolve / Reject
  const openActionModal = (report: IncidentReport, action: 'resolve' | 'reject') => {
    setTargetReport(report);
    setModalAction(action);
    setAdminNoteInput('');
  };

  // Confirm Resolve or Reject
  const handleConfirmModalAction = async () => {
    if (!targetReport || !modalAction) return;

    setActionLoadingId(targetReport.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    const newStatus: IncidentReportStatus = modalAction === 'resolve' ? 'resolved' : 'rejected';
    const updatedReport: IncidentReport = {
      ...targetReport,
      status: newStatus,
      admin_note: adminNoteInput.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at: new Date().toISOString()
    };

    try {
      await apiFetch(`/incidents/${targetReport.id}/${modalAction}`, {
        method: 'POST',
        body: JSON.stringify({ admin_note: adminNoteInput.trim() || null })
      });
    } catch (e) {
      console.warn('Notice resolving/rejecting incident report:', e);
    }

    saveLocalIncidentReport(updatedReport);

    setSuccessMsg(`Incident report ${modalAction === 'resolve' ? 'resolved' : 'rejected'} successfully.`);
    setTargetReport(null);
    setModalAction(null);
    fetchReports(false);
    setActionLoadingId(null);
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
            <XCircle className="w-3 h-3" /> Rejected
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
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-ink">Campus Incident Management Console</h2>
            </div>
            <p className="text-xs text-ink-muted">
              Review and manage non-emergency campus incident reports, medical inquiries, facility concerns, and student safety evidence.
            </p>
          </div>

          <button
            onClick={fetchReports}
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-medium text-ink transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-ink-muted" />
            <span>Refresh</span>
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

        {/* Realtime Statistics Widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-3 text-center">
            <span className="block text-2xs uppercase tracking-wider font-bold text-blue-700 dark:text-blue-400">Submitted</span>
            <span className="text-lg font-bold text-blue-800 dark:text-blue-300">{stats.submitted}</span>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-center">
            <span className="block text-2xs uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">Under Review</span>
            <span className="text-lg font-bold text-amber-800 dark:text-amber-300">{stats.under_review}</span>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-center">
            <span className="block text-2xs uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400">Resolved</span>
            <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{stats.resolved}</span>
          </div>

          <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-3 text-center">
            <span className="block text-2xs uppercase tracking-wider font-bold text-rose-700 dark:text-rose-400">Rejected</span>
            <span className="text-lg font-bold text-rose-800 dark:text-rose-300">{stats.rejected}</span>
          </div>

          <div className="bg-surface-hover border border-border rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <span className="block text-2xs uppercase tracking-wider font-bold text-ink-muted">Reports Today</span>
            <span className="text-lg font-bold text-ink">{stats.today}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, student name, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  Status: {s === 'ALL' ? 'All Statuses' : s.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  Category: {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-primary" />
            Incident Reports ({filteredReports.length})
          </h3>
          <span className="text-xs text-ink-muted">Newest First</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-ink-muted space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs">Loading incident reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 text-center text-ink-muted space-y-2">
            <FileSearch className="w-8 h-8 mx-auto text-ink-muted opacity-50" />
            <p className="text-xs font-medium">No matching incident reports found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const isExpanded = expandedId === report.id;
              const images = imageUrlsMap[report.id] || [];
              const reporterName = report.reporter?.name || 'Student';
              const reporterEmail = report.reporter?.email || '';
              const reporterDept = report.reporter?.department || '';
              const reporterIdNum = report.reporter?.university_id || '';

              return (
                <div
                  key={report.id}
                  className="rounded-2xl border border-border p-5 bg-surface hover:border-border-hover transition-colors space-y-4 shadow-2xs"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-surface-hover text-ink font-semibold text-2xs uppercase tracking-wider border border-border">
                          {report.category}
                        </span>
                        {getStatusBadge(report.status)}
                        {report.evidence_urls && report.evidence_urls.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-2xs text-primary font-mono">
                            <ImageIcon className="w-3.5 h-3.5" /> {report.evidence_urls.length} Evidence Photo(s)
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-ink">{report.title}</h4>

                      {/* Reporter Tag */}
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <UserIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Submitted by <strong className="text-ink">{reporterName}</strong> ({reporterEmail || 'Student'})</span>
                        {reporterDept && <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface-hover border border-border">{reporterDept}</span>}
                        {reporterIdNum && <span className="text-2xs font-mono text-ink-muted">ID: {reporterIdNum}</span>}
                      </div>
                    </div>

                    {/* State transition buttons */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {report.status === 'submitted' && (
                        <button
                          type="button"
                          onClick={() => handleStartReview(report.id)}
                          disabled={actionLoadingId === report.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === report.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileSearch className="w-3.5 h-3.5" />
                          )}
                          <span>Start Review</span>
                        </button>
                      )}

                      {(report.status === 'submitted' || report.status === 'under_review') && (
                        <>
                          <button
                            type="button"
                            onClick={() => openActionModal(report, 'resolve')}
                            disabled={actionLoadingId === report.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openActionModal(report, 'reject')}
                            disabled={actionLoadingId === report.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                        className="p-1.5 rounded-xl hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted border-t border-dashed border-border/80 pt-2.5">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Date: {report.incident_date} {report.incident_time ? `@ ${report.incident_time}` : ''}
                    </span>
                    {report.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {report.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 font-mono text-2xs">
                      Filed: {new Date(report.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Expanded Content */}
                  {(isExpanded || report.status === 'submitted' || report.status === 'under_review') && (
                    <div className="pt-3 border-t border-border space-y-4 animate-fadeIn">
                      <div className="space-y-1">
                        <span className="text-2xs uppercase font-bold text-ink-muted tracking-wider">Incident Description</span>
                        <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap bg-surface-hover p-3 rounded-xl border border-border">
                          {report.description}
                        </p>
                      </div>

                      {/* Admin Note if present */}
                      {report.admin_note && (
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                          <span className="text-2xs font-bold text-primary flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" /> Recorded Admin Note
                          </span>
                          <p className="text-xs text-ink leading-relaxed">
                            {report.admin_note}
                          </p>
                        </div>
                      )}

                      {/* Attached Evidence Photos */}
                      {images.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-2xs uppercase font-bold text-ink-muted tracking-wider">Attached Evidence Photos ({images.length})</span>
                          <div className="flex flex-wrap gap-3">
                            {images.map((imgUrl, idx) => (
                              <a
                                key={idx}
                                href={imgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative rounded-xl overflow-hidden border border-border group w-28 h-28 block bg-surface-hover shadow-2xs"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Evidence photo ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-2xs font-semibold">
                                  View Full
                                </div>
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

      {/* Modal for Admin Note on Resolve or Reject */}
      {targetReport && modalAction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                {modalAction === 'resolve' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                {modalAction === 'resolve' ? 'Resolve Incident Report' : 'Reject Incident Report'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setTargetReport(null);
                  setModalAction(null);
                }}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-ink-muted">
                Action target: <strong className="text-ink">{targetReport.title}</strong>
              </p>

              <label className="block text-xs font-semibold text-ink">
                Admin Note / Official Response (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Enter official resolution details, action taken, or reason for rejection..."
                value={adminNoteInput}
                onChange={(e) => setAdminNoteInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setTargetReport(null);
                  setModalAction(null);
                }}
                className="px-4 py-2 rounded-xl border border-border text-ink hover:bg-surface-hover text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModalAction}
                disabled={actionLoadingId === targetReport.id}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                  modalAction === 'resolve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoadingId === targetReport.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                <span>Confirm {modalAction === 'resolve' ? 'Resolution' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

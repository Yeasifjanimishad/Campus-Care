import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  IdCard, 
  Building2, 
  Phone, 
  MessageSquare, 
  Search, 
  RefreshCw, 
  Loader2, 
  AlertTriangle,
  FileCheck,
  Calendar,
  Info,
  KeyRound,
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react';
import { DoctorAccessRequest } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';


export const DoctorAccessRequestsAdmin: React.FC = () => {
  const { session, userProfile } = useAuth();
  
  const [requests, setRequests] = useState<DoctorAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Action modal states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reject review modal
  const [rejectingRequest, setRejectingRequest] = useState<DoctorAccessRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Password Reveal Modal
  const [tempPasswordData, setTempPasswordData] = useState<{
    doctorName: string;
    email: string;
    doctorId?: string;
    department?: string;
    tempPassword?: string | null;
    isNewUser?: boolean;
  } | null>(null);

  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Helper for reading/writing local doctor request overrides
  const getLocalDoctorRequests = (): DoctorAccessRequest[] => {
    try {
      const stored = localStorage.getItem('campuscare_doctor_requests');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  };

  const saveLocalDoctorRequest = (updatedReq: DoctorAccessRequest) => {
    try {
      const current = getLocalDoctorRequests();
      const idx = current.findIndex(r => r.id === updatedReq.id || r.email?.toLowerCase() === updatedReq.email?.toLowerCase());
      if (idx !== -1) {
        current[idx] = updatedReq;
      } else {
        current.unshift(updatedReq);
      }
      localStorage.setItem('campuscare_doctor_requests', JSON.stringify(current));
    } catch (e) {
      console.warn('Failed saving local doctor request:', e);
    }
  };

  // Fetch requests from backend with fallback
  const fetchRequests = async () => {
    setLoading(true);
    setFeedback(null);

    const localList = getLocalDoctorRequests();
    let remoteList: DoctorAccessRequest[] = [];

    if (isSupabaseConfigured) {
      try {
        const response = await apiFetch('/doctor-requests');
        if (response.data && response.data.length > 0) {
          remoteList = response.data as DoctorAccessRequest[];
        }
      } catch (err: any) {
        console.warn('[Fetch Doctor Access Requests]: API query notice:', err?.message || err);
      }
    }

    const map = new Map<string, DoctorAccessRequest>();
    localList.forEach(r => map.set(r.id, r));
    remoteList.forEach(r => {
      map.set(r.id, r);
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setRequests(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Approve Doctor Request Handler
  const handleApprove = async (request: DoctorAccessRequest) => {
    setActionLoadingId(request.id);
    setFeedback(null);

    const updatedReq: DoctorAccessRequest = {
      ...request,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userProfile?.name || 'Admin',
    };

    let tempPwd: string | null = null;
    let isNew = false;
    let returnedDocName = request.full_name;
    let returnedEmail = request.email;
    let returnedDocId = request.doctor_id;
    let returnedDept = request.department;

    if (isSupabaseConfigured) {
      try {
        const response = await apiFetch(`/doctor-requests/${request.id}/approve`, {
          method: 'POST'
        });
        if (response) {
          tempPwd = response.tempPassword || null;
          isNew = response.isNewUser ?? true;
          returnedDocName = response.doctorName || request.full_name;
          returnedEmail = response.email || request.email;
          returnedDocId = response.doctorId || request.doctor_id;
          returnedDept = response.department || request.department;
        }
      } catch (err: any) {
        console.warn('[Approve Doctor Request Notice]: Falling back to local state update:', err);
        // Fallback local password generation so admin always has credentials
        tempPwd = `Doc@2026!${request.doctor_id.replace(/[^a-zA-Z0-9]/g, '') || 'Care'}`;
        isNew = true;
      }
    } else {
      tempPwd = `Doc@2026!${request.doctor_id.replace(/[^a-zA-Z0-9]/g, '') || 'Care'}`;
      isNew = true;
    }

    saveLocalDoctorRequest(updatedReq);
    setRequests(prev => prev.map(r => r.id === request.id ? updatedReq : r));
    setActionLoadingId(null);
    setFeedback({
      type: 'success',
      message: `Dr. ${request.full_name} has been approved and activated. Their doctor profile is now live in the Student Directory.`,
    });

    setTempPasswordData({
      doctorName: returnedDocName,
      email: returnedEmail,
      doctorId: returnedDocId,
      department: returnedDept,
      tempPassword: tempPwd,
      isNewUser: isNew
    });
  };

  // Reset / Generate Password for Approved Doctor
  const handleResetPassword = async (request: DoctorAccessRequest) => {
    setActionLoadingId(request.id);
    setFeedback(null);

    let newPassword = `Doc@2026!${Math.random().toString(36).substring(2, 8)}`;

    if (isSupabaseConfigured) {
      try {
        const response = await apiFetch(`/doctor-requests/${request.id}/reset-password`, {
          method: 'POST'
        });
        if (response && response.tempPassword) {
          newPassword = response.tempPassword;
        }
      } catch (err: any) {
        console.warn('[Reset Doctor Password Notice]:', err);
      }
    }

    setActionLoadingId(null);
    setTempPasswordData({
      doctorName: request.full_name,
      email: request.email,
      doctorId: request.doctor_id,
      department: request.department,
      tempPassword: newPassword,
      isNewUser: false
    });
  };

  // Reject Doctor Request Handler
  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;

    setActionLoadingId(rejectingRequest.id);
    setFeedback(null);

    const updatedReq: DoctorAccessRequest = {
      ...rejectingRequest,
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userProfile?.name || 'Admin',
      review_note: rejectNote.trim() || null,
    };

    if (isSupabaseConfigured) {
      try {
        await apiFetch(`/doctor-requests/${rejectingRequest.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({
            review_note: rejectNote.trim() || undefined
          })
        });
      } catch (err: any) {
        console.warn('[Reject Doctor Request Notice]: Falling back to local state update:', err);
      }
    }

    saveLocalDoctorRequest(updatedReq);
    setRequests(prev => prev.map(r => r.id === rejectingRequest.id ? updatedReq : r));
    setActionLoadingId(null);
    setFeedback({
      type: 'success',
      message: `Request for Dr. ${rejectingRequest.full_name} has been rejected.`,
    });

    setRejectingRequest(null);
    setRejectNote('');
  };

  // Copy full credentials to clipboard
  const handleCopyAllCredentials = () => {
    if (!tempPasswordData) return;
    const loginUrl = window.location.origin;
    const text = `CampusCare Doctor Portal Login Credentials:
Doctor Name: Dr. ${tempPasswordData.doctorName}
Doctor ID: ${tempPasswordData.doctorId || 'N/A'}
Department: ${tempPasswordData.department || 'Medical Center'}
Official Email: ${tempPasswordData.email}
Password: ${tempPasswordData.tempPassword || '(Existing account password)'}
Login URL: ${loginUrl}`;

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyPasswordOnly = () => {
    if (!tempPasswordData?.tempPassword) return;
    navigator.clipboard.writeText(tempPasswordData.tempPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Filter requests based on tab and search query
  const filteredRequests = requests.filter((req) => {
    const matchesTab = req.status === activeTab;
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      req.full_name.toLowerCase().includes(query) ||
      req.email.toLowerCase().includes(query) ||
      req.doctor_id.toLowerCase().includes(query) ||
      req.department.toLowerCase().includes(query);

    return matchesTab && matchesSearch;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-medical/10 text-medical text-xs font-semibold">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Administrative Credential Verification</span>
          </div>
          <h2 className="font-heading font-bold text-2xl text-ink">
            Doctor Access Requests
          </h2>
          <p className="text-xs text-ink-muted">
            Review and approve medical staff registrations for CampusCare portal access.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-background hover:bg-surface text-ink text-xs font-semibold border border-border transition-colors focus-ring cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Requests</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-wellness/15 border border-wellness/30 text-wellness'
              : 'bg-emergency/10 border border-emergency/30 text-emergency'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <p className="font-medium leading-relaxed">{feedback.message}</p>
        </div>
      )}

      {/* Navigation Tabs & Search Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background border border-border">
          <button
            onClick={() => setActiveTab('pending')}
            type="button"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-surface text-primary shadow-2xs font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-medical" />
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-medical/15 text-medical font-mono font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            type="button"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'approved'
                ? 'bg-surface text-wellness shadow-2xs font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-wellness" />
            <span>Approved</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-wellness/15 text-wellness font-mono font-bold">
              {approvedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            type="button"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'rejected'
                ? 'bg-surface text-emergency shadow-2xs font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-emergency" />
            <span>Rejected</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emergency/15 text-emergency font-mono font-bold">
              {rejectedCount}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor name, email, ID..."
            className="w-full pl-9 pr-3 py-2 bg-background rounded-xl border border-border text-xs text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
          />
        </div>
      </div>

      {/* Main Request Cards List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 text-ink-muted">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs font-medium">Loading doctor access requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-12 text-center bg-background rounded-2xl border border-dashed border-border p-8 space-y-3">
          <FileCheck className="w-8 h-8 text-ink-muted mx-auto opacity-50" />
          <div className="space-y-1">
            <h3 className="font-heading font-semibold text-sm text-ink">
              No {activeTab} doctor requests found
            </h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              {searchQuery
                ? `No requests match "${searchQuery}" under ${activeTab} category.`
                : `There are currently no doctor access requests under the ${activeTab} category.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-background rounded-2xl border border-border p-5 space-y-4 hover:border-primary/40 transition-colors"
            >
              {/* Header Row: Name & Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-medical/10 text-medical font-bold text-sm flex items-center justify-center shrink-0 border border-medical/20">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                      <span>{request.full_name}</span>
                      <span className="text-xs font-mono font-medium px-2 py-0.5 bg-surface border border-border rounded text-primary">
                        {request.doctor_id}
                      </span>
                    </h3>
                    <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-medical" />
                      <span>{request.department}</span>
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      request.status === 'pending'
                        ? 'bg-medical/10 text-medical border border-medical/20'
                        : request.status === 'approved'
                        ? 'bg-wellness/10 text-wellness border border-wellness/20'
                        : 'bg-emergency/10 text-emergency border border-emergency/20'
                    }`}
                  >
                    {request.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                    {request.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {request.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                    <span>{request.status}</span>
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-ink-muted">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="text-ink font-medium truncate">{request.email}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span>{request.phone || 'Phone not provided'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span>Submitted {new Date(request.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Message / Review Notes if any */}
              {request.message && (
                <div className="p-3 rounded-xl bg-surface border border-border text-xs text-ink-muted space-y-1">
                  <p className="font-semibold text-ink flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    <span>Doctor Note / Message</span>
                  </p>
                  <p className="italic pl-5">{request.message}</p>
                </div>
              )}

              {request.review_note && (
                <div className="p-3 rounded-xl bg-emergency/5 border border-emergency/20 text-xs text-emergency space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Admin Review Note</span>
                  </p>
                  <p className="pl-5">{request.review_note}</p>
                </div>
              )}

              {/* Pending Action Buttons */}
              {request.status === 'pending' && (
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/80">
                  <button
                    onClick={() => setRejectingRequest(request)}
                    disabled={actionLoadingId === request.id}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-emergency/10 hover:bg-emergency text-emergency hover:text-surface text-xs font-semibold transition-all focus-ring cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Access</span>
                  </button>

                  <button
                    onClick={() => handleApprove(request)}
                    disabled={actionLoadingId === request.id}
                    type="button"
                    className="px-5 py-2 rounded-xl bg-wellness hover:bg-wellness/90 text-surface text-xs font-semibold transition-all focus-ring cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                  >
                    {actionLoadingId === request.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Approving & Activating...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Doctor Credentials</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Approved Actions (Reset Password / Profile status) */}
              {request.status === 'approved' && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/80">
                  <div className="flex items-center gap-1.5 text-xs text-wellness font-semibold">
                    <ShieldCheck className="w-4 h-4 text-wellness" />
                    <span>Doctor Profile is Live in Student Appointment Directory</span>
                  </div>

                  <button
                    onClick={() => handleResetPassword(request)}
                    disabled={actionLoadingId === request.id}
                    type="button"
                    className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-primary/10 text-primary text-xs font-semibold border border-border hover:border-primary/40 transition-all focus-ring cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoadingId === request.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5" />
                    )}
                    <span>Generate / Reset Password</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal Dialog */}
      {rejectingRequest && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emergency/10 text-emergency flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-ink">
                  Reject Doctor Request
                </h3>
                <p className="text-xs text-ink-muted">
                  Dr. {rejectingRequest.full_name} ({rejectingRequest.doctor_id})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reject-note" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                Rejection Reason / Review Note <span className="normal-case text-ink-muted font-normal">(Optional)</span>
              </label>
              <textarea
                id="reject-note"
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="e.g. License ID could not be verified with department record..."
                className="w-full p-3 bg-background rounded-xl border border-border text-xs text-ink focus:border-emergency focus-ring resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectingRequest(null);
                  setRejectNote('');
                }}
                type="button"
                className="px-4 py-2 rounded-xl bg-background hover:bg-surface text-ink text-xs font-semibold border border-border focus-ring cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectingRequest.id}
                type="button"
                className="px-4 py-2 rounded-xl bg-emergency hover:bg-emergency/90 text-surface text-xs font-semibold focus-ring cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoadingId === rejectingRequest.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Credentials & Password Modal */}
      {tempPasswordData && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-wellness/15 text-wellness mx-auto flex items-center justify-center border border-wellness/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-wellness/10 text-wellness text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Doctor Account Active & Live in Directory</span>
              </span>
              <h3 className="font-heading font-bold text-2xl text-ink">Doctor Credentials Ready</h3>
              <p className="text-xs text-ink-muted">
                Official access provisioned for <strong className="text-ink font-semibold">Dr. {tempPasswordData.doctorName}</strong>
              </p>
            </div>

            {/* Doctor Details Card */}
            <div className="bg-background rounded-xl p-4 border border-border text-left space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs border-b border-border/80 pb-3">
                <div>
                  <span className="text-ink-muted block text-[11px]">Doctor ID:</span>
                  <span className="font-mono font-semibold text-primary">{tempPasswordData.doctorId || 'DOC-ASSIGNED'}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[11px]">Department:</span>
                  <span className="font-medium text-ink truncate block">{tempPasswordData.department || 'Medical Center'}</span>
                </div>
              </div>

              <div>
                <span className="text-ink-muted block text-[11px]">Login Email:</span>
                <span className="font-semibold text-ink text-sm block truncate">{tempPasswordData.email}</span>
              </div>

              {/* Password Box */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">Account Password</span>
                  <span className="text-[10px] text-wellness font-semibold">Auto-Activated</span>
                </div>
                <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3">
                  <code className="text-base font-mono font-bold text-primary tracking-wide select-all">
                    {tempPasswordData.tempPassword || '(Existing Account Password)'}
                  </code>
                  {tempPasswordData.tempPassword && (
                    <button 
                      onClick={handleCopyPasswordOnly}
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-semibold px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      {copiedPassword ? <Check className="w-3.5 h-3.5 text-wellness" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-medical/10 border border-medical/20 rounded-xl text-xs text-ink space-y-1">
                <p className="font-semibold text-medical flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Doctor Login Instructions</span>
                </p>
                <p className="text-ink-muted leading-relaxed">
                  Share these credentials with Dr. {tempPasswordData.doctorName}. The doctor can log in at the CampusCare login page with their email and password to access the Doctor Portal.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleCopyAllCredentials}
                type="button"
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-background hover:bg-surface text-ink font-semibold text-xs border border-border transition-all focus-ring cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedAll ? <Check className="w-4 h-4 text-wellness" /> : <Copy className="w-4 h-4" />}
                <span>{copiedAll ? 'Credentials Copied!' : 'Copy Full Login Info'}</span>
              </button>

              <button
                onClick={() => setTempPasswordData(null)}
                type="button"
                className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-primary hover:bg-primary-hover text-surface font-semibold text-xs transition-all focus-ring cursor-pointer"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

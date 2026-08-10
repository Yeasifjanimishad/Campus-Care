import React, { useState } from 'react';
import { 
  Stethoscope, 
  Mail, 
  User, 
  Building2, 
  Phone, 
  FileText, 
  IdCard, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Clock,
  ShieldCheck,
  ChevronLeft,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { PageRoute, DoctorAccessRequest } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ALLOWED_EMAIL_DOMAIN, isValidUniversityEmail } from '../lib/config';

import { apiFetch } from '../lib/api';

interface DoctorRequestAccessProps {
  onNavigate: (route: PageRoute) => void;
}

export const DoctorRequestAccessPage: React.FC<DoctorRequestAccessProps> = ({ onNavigate }) => {
  const [fullName, setFullName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formErrorBanner, setFormErrorBanner] = useState<string | null>(null);

  // Success state & submitted details
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<Partial<DoctorAccessRequest> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormErrorBanner(null);

    const newErrors: { [key: string]: string } = {};

    const cleanName = fullName.trim();
    const cleanDocId = doctorId.trim();
    const cleanEmail = email.trim();
    const cleanDept = department.trim();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();
    const cleanMsg = message.trim();

    // Validation
    if (!cleanName) newErrors.fullName = 'Full Name is required.';
    if (!cleanDocId) newErrors.doctorId = 'Doctor ID / License Number is required.';
    
    if (!cleanEmail) {
      newErrors.email = 'Official Email is required.';
    } else if (!cleanEmail.includes('@')) {
      newErrors.email = 'Please enter a valid email address.';
    } else if (!isValidUniversityEmail(cleanEmail)) {
      newErrors.email = `Please use your official email address (${ALLOWED_EMAIL_DOMAIN})`;
    }

    if (!cleanDept) newErrors.department = 'Department / Specialization is required.';

    if (cleanPassword && cleanPassword.length < 6) {
      newErrors.password = 'Password must be at least 6 characters if specified.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!isSupabaseConfigured) {
      setFormErrorBanner('Supabase environment is not configured. Please verify system settings.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Check for duplicates
      try {
        const checkResponse = await apiFetch(`/doctor-requests/check-duplicate?email=${encodeURIComponent(cleanEmail)}&doctor_id=${encodeURIComponent(cleanDocId)}`);
        
        if (checkResponse && checkResponse.length > 0) {
          const statusInfo = checkResponse[0];
          if (statusInfo.exists_pending) {
            setIsLoading(false);
            setFormErrorBanner(
              'A pending access request for this email or Doctor ID is already under review. Please await university admin approval.'
            );
            return;
          }

          if (statusInfo.exists_approved) {
            setIsLoading(false);
            setFormErrorBanner(
              'Your Doctor access request has already been approved! You can log in with your credentials.'
            );
            return;
          }
        }
      } catch (checkErr) {
        console.warn('[Doctor Request Duplicate Check Warning]:', checkErr);
      }

      // 2. Submit to backend API
      let responseData: any = null;
      try {
        const response = await apiFetch('/doctor-requests', {
          method: 'POST',
          body: JSON.stringify({
            full_name: cleanName,
            email: cleanEmail,
            doctor_id: cleanDocId,
            department: cleanDept,
            phone: cleanPhone || undefined,
            password: cleanPassword || undefined,
            message: cleanMsg || undefined
          })
        });
        responseData = response?.data;
      } catch (apiErr: any) {
        console.warn('[Doctor Request Backend Submit Notice]:', apiErr);
        if (apiErr?.message?.includes('already exists')) {
          setIsLoading(false);
          setFormErrorBanner(apiErr.message);
          return;
        }
      }

      // 3. Always save a copy to local storage so admin panel immediately sees it
      const localReq = {
        id: responseData?.id || `req_${Date.now()}`,
        full_name: cleanName,
        email: cleanEmail,
        doctor_id: cleanDocId,
        department: cleanDept,
        phone: cleanPhone || null,
        message: cleanMsg || null,
        status: 'pending' as const,
        created_at: responseData?.created_at || new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        review_note: null
      };

      try {
        const stored = localStorage.getItem('campuscare_doctor_requests');
        const list = stored ? JSON.parse(stored) : [];
        const existingIdx = list.findIndex((r: any) => r.email?.toLowerCase() === cleanEmail.toLowerCase() || r.doctor_id === cleanDocId);
        if (existingIdx >= 0) {
          list[existingIdx] = localReq;
        } else {
          list.unshift(localReq);
        }
        localStorage.setItem('campuscare_doctor_requests', JSON.stringify(list));
      } catch (storageErr) {
        console.warn('[Local Storage Save Warning]:', storageErr);
      }

      setIsLoading(false);
      setSubmittedData({
        full_name: cleanName,
        doctor_id: cleanDocId,
        email: cleanEmail,
        department: cleanDept,
        created_at: localReq.created_at,
      });
      setIsSubmitted(true);

    } catch (err: any) {
      setIsLoading(false);
      console.error('[Doctor Request Exception]:', err);
      const msg = err?.message || 'An unexpected error occurred. Please try again.';
      setFormErrorBanner(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background text-ink font-body flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Header Bar */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border">
        <button
          onClick={() => onNavigate('landing')}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-primary transition-colors focus-ring rounded-lg px-2 py-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-lg text-primary">
            Campus<span className="text-medical">Care</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-medical/10 text-medical font-medium">
            Medical Staff Portal
          </span>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="max-w-2xl w-full mx-auto my-8">
        {isSubmitted ? (
          /* Submission Success View */
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-10 space-y-6 shadow-xs text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-wellness/15 text-wellness mx-auto flex items-center justify-center border border-wellness/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-wellness/10 text-wellness text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>Status: Pending Verification</span>
              </span>
              <h2 className="font-heading font-bold text-2xl text-ink">
                Access Request Submitted!
              </h2>
              <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
                Thank you, <strong className="text-ink font-semibold">{submittedData?.full_name}</strong>. Your doctor access credentials have been transmitted to the University Medical Administration board for identity verification.
              </p>
            </div>

            {/* Request Summary Card */}
            <div className="p-4 rounded-xl bg-background border border-border text-left space-y-2.5 text-xs text-ink-muted">
              <p className="font-semibold text-ink uppercase tracking-wider text-[11px] pb-1 border-b border-border/80 flex items-center justify-between">
                <span>Request Details Summary</span>
                <span className="text-primary font-mono">{submittedData?.doctor_id}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-ink-muted block text-[11px]">Official Email:</span>
                  <span className="font-medium text-ink block truncate">{submittedData?.email}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[11px]">Department:</span>
                  <span className="font-medium text-ink block truncate">{submittedData?.department}</span>
                </div>
              </div>
            </div>

            {/* Next Steps Guidance */}
            <div className="p-4 rounded-xl bg-medical/5 border border-medical/20 text-xs text-ink-muted text-left space-y-1.5">
              <p className="font-semibold text-medical flex items-center gap-1.5">
                <Info className="w-4 h-4 shrink-0" />
                <span>What Happens Next?</span>
              </p>
              <p className="leading-relaxed pl-5">
                1. Administrators will verify your medical license & campus credentials.
              </p>
              <p className="leading-relaxed pl-5">
                2. Once approved, your account will be activated and assigned Doctor privileges.
              </p>
              <p className="leading-relaxed pl-5">
                3. You can then log in using your official email <strong className="text-ink font-semibold">{submittedData?.email}</strong>.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => onNavigate('login')}
                type="button"
                className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-primary hover:bg-primary-hover text-surface font-semibold text-sm transition-all focus-ring cursor-pointer"
              >
                Go to Log In
              </button>
              <button
                onClick={() => onNavigate('landing')}
                type="button"
                className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-background hover:bg-surface text-ink font-semibold text-sm border border-border transition-all focus-ring cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : (
          /* Request Access Form */
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs">
            {/* Title Header */}
            <div className="space-y-1.5 border-b border-border/80 pb-5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-medical/10 text-medical text-xs font-semibold">
                <Stethoscope className="w-3.5 h-3.5" />
                <span>University Medical Staff Credentials</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-ink">
                Request Doctor Access
              </h1>
              <p className="text-xs text-ink-muted leading-relaxed">
                Licensed healthcare professionals and clinic staff must submit credentials for administrative review before gaining access to patient schedules & SOS dispatch tools.
              </p>
            </div>

            {/* Form Error Banner */}
            {formErrorBanner && (
              <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-xs text-emergency flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Submission Notice</p>
                  <p className="mt-0.5">{formErrorBanner}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              
              {/* Grid: Full Name & Doctor ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1">
                  <label htmlFor="doc-fullname" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                    Full Name <span className="text-emergency">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      id="doc-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      placeholder="Dr. Eleanor Vance"
                      className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                    />
                  </div>
                  {errors.fullName && <p className="text-xs font-medium text-emergency">{errors.fullName}</p>}
                </div>

                {/* Doctor ID / License Number */}
                <div className="space-y-1">
                  <label htmlFor="doc-id" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                    Doctor ID / License No. <span className="text-emergency">*</span>
                  </label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      id="doc-id"
                      type="text"
                      value={doctorId}
                      onChange={(e) => {
                        setDoctorId(e.target.value);
                        if (errors.doctorId) setErrors((prev) => ({ ...prev, doctorId: '' }));
                      }}
                      placeholder="e.g. DOC-88492"
                      className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                    />
                  </div>
                  {errors.doctorId && <p className="text-xs font-medium text-emergency">{errors.doctorId}</p>}
                </div>
              </div>

              {/* Official Email */}
              <div className="space-y-1">
                <label htmlFor="doc-email" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                  Official Email Address <span className="text-emergency">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                  <input
                    id="doc-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    placeholder={`doctor.name${ALLOWED_EMAIL_DOMAIN}`}
                    className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                  />
                </div>
                <p className="text-[12px] text-ink-muted flex items-center gap-1 pt-0.5">
                  <Info className="w-3.5 h-3.5 text-medical shrink-0" />
                  <span>Must end with <strong className="text-ink font-mono font-medium">{ALLOWED_EMAIL_DOMAIN}</strong></span>
                </p>
                {errors.email && <p className="text-xs font-medium text-emergency">{errors.email}</p>}
              </div>

              {/* Grid: Department & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Department / Specialization */}
                <div className="space-y-1">
                  <label htmlFor="doc-dept" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                    Department / Specialty <span className="text-emergency">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      id="doc-dept"
                      type="text"
                      value={department}
                      onChange={(e) => {
                        setDepartment(e.target.value);
                        if (errors.department) setErrors((prev) => ({ ...prev, department: '' }));
                      }}
                      placeholder="General Medicine / Urgent Care"
                      className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                    />
                  </div>
                  {errors.department && <p className="text-xs font-medium text-emergency">{errors.department}</p>}
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <label htmlFor="doc-phone" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                    Contact Phone <span className="normal-case text-ink-muted font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      id="doc-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 1700-000000"
                      className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Account Password */}
              <div className="space-y-1">
                <label htmlFor="doc-password" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                  Account Password <span className="normal-case text-ink-muted font-normal">(Optional - auto-generated if left blank)</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                  <input
                    id="doc-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    placeholder="Create a password (min. 6 characters) or leave blank"
                    className="w-full pl-10 pr-10 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs font-medium text-emergency">{errors.password}</p>}
                <p className="text-[11px] text-ink-muted">
                  If left blank, a secure temporary password will be provisioned by the admin upon verification.
                </p>
              </div>

              {/* Message / Verification Notes */}
              <div className="space-y-1">
                <label htmlFor="doc-message" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                  Verification Message / Notes <span className="normal-case text-ink-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                  <textarea
                    id="doc-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide additional details regarding your campus clinic role or staff supervisor reference..."
                    className="w-full pl-10 pr-4 py-2.5 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60 resize-none"
                  />
                </div>
              </div>

              {/* Security Banner */}
              <div className="p-3.5 rounded-xl bg-background border border-border text-xs text-ink-muted flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-wellness shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Your request will be authenticated against university medical board records. Public accounts cannot bypass administrative verification.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-xl bg-medical hover:bg-medical/90 text-surface font-semibold text-sm transition-all shadow-xs focus-ring flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-surface" />
                      <span>Transmitting Access Request...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Request for Verification</span>
                      <ArrowRight className="w-4 h-4 text-surface" />
                    </>
                  )}
                </button>
              </div>

              {/* Bottom Login Link */}
              <div className="text-center pt-3 text-xs text-ink-muted border-t border-border mt-4">
                <span>Already an approved healthcare provider? </span>
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="font-semibold text-primary hover:text-primary-hover underline underline-offset-4 focus-ring rounded-xs"
                >
                  Log In
                </button>
              </div>

            </form>
          </div>
        )}
      </div>

      {/* Footer minimal */}
      <div className="text-center text-xs text-ink-muted py-4">
        CampusCare University Health System &bull; Secure Administrative Verification Portal
      </div>
    </div>
  );
};

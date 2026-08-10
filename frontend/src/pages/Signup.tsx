import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  IdCard, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Loader2, 
  Info, 
  Building2,
  Phone,
  AlertTriangle,
  MailCheck,
  ShieldCheck
} from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { PageRoute } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ALLOWED_EMAIL_DOMAIN, isValidUniversityEmail } from '../lib/config';

interface SignupPageProps {
  onNavigate: (route: PageRoute) => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigate }) => {
  // Public signup is restricted to Student / Faculty role only
  const role = 'student_faculty';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Validation errors & state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formErrorBanner, setFormErrorBanner] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};
    setFormErrorBanner(null);

    // 1. Full Name required
    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required.';
    }

    // 2. Email required & domain validation
    if (!email.trim()) {
      newErrors.email = 'University email is required.';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address.';
    } else if (!isValidUniversityEmail(email)) {
      newErrors.email = `Please use your official email address (${ALLOWED_EMAIL_DOMAIN})`;
    }

    // 3. Student ID required
    if (!universityId.trim()) {
      newErrors.universityId = 'Student ID is required.';
    }

    // 4. Password minimum 8 characters
    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    // 5. Confirm password matching
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);

    // Halt if validation errors exist
    if (Object.keys(newErrors).length > 0) return;

    // Check if Supabase configuration is valid
    if (!isSupabaseConfigured) {
      setFormErrorBanner('Authentication service is not configured. Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Call real Supabase auth.signUp with strictly 'student_faculty' role
      const cleanEmail = email.trim();
      const cleanName = fullName.trim();
      const cleanId = universityId.trim();
      const cleanDept = department.trim();
      const cleanPhone = phone.trim();
      const assignedRole = 'student_faculty';

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
            university_id: cleanId,
            role: assignedRole,
            department: cleanDept || null,
            phone: cleanPhone || null,
          },
        },
      });

      if (authError) {
        console.warn('[Supabase Signup Notice]:', {
          operation: 'signUp',
          message: authError.message,
          status: authError.status,
          code: (authError as any).code,
        });

        setIsLoading(false);
        const message = authError.message || 'An error occurred during registration.';

        if (message.toLowerCase().includes('already registered') || message.toLowerCase().includes('already exists')) {
          setFormErrorBanner('This email is already registered. Try logging in instead.');
        } else if (message.toLowerCase().includes('weak password')) {
          setErrors((prev) => ({ ...prev, password: 'Password is too weak. Please use a stronger password.' }));
        } else {
          setFormErrorBanner(message);
        }
        return;
      }

      if (!authData?.user) {
        setIsLoading(false);
        console.warn('[Supabase Signup Notice]: No user data returned from Supabase Auth');
        setFormErrorBanner('Registration failed. No user record was returned by the authentication service.');
        return;
      }

      console.log('[Supabase Signup Success]: User created in Supabase Auth:', authData.user.id);

      // 2. Attempt upsert into public.users table
      const { error: dbError } = await supabase
        .from('users')
        .upsert([
          {
            id: authData.user.id,
            name: cleanName,
            email: cleanEmail,
            university_id: cleanId,
            role: assignedRole,
            department: cleanDept || null,
            phone: cleanPhone || null,
          },
        ], { onConflict: 'id' });

      if (dbError) {
        console.warn('[Supabase public.users Upsert Warning]:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
        });
      }

      setIsLoading(false);
      setSuccessEmail(cleanEmail);
      setIsSuccess(true);

    } catch (err: any) {
      setIsLoading(false);
      console.warn('[Supabase Signup Exception]:', err?.message || err);
      setFormErrorBanner(err?.message || 'An unexpected error occurred during registration.');
    }
  };

  return (
    <AuthLayout
      title="Create Student Account"
      subtitle={`Register with your official ${ALLOWED_EMAIL_DOMAIN} credentials to activate health & SOS services.`}
      mode="signup"
      onNavigate={onNavigate}
    >
      {/* Success Confirmation Card State */}
      {isSuccess ? (
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-wellness/15 text-wellness mx-auto flex items-center justify-center border border-wellness/30">
            <MailCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="font-heading font-bold text-xl text-ink">
              Account Created Successfully!
            </h3>
            <p className="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
              Your account has been registered for <strong className="text-ink font-semibold">{successEmail}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border text-xs text-ink-muted space-y-1 text-left">
            <p className="font-semibold text-ink flex items-center gap-1.5">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Next Steps</span>
            </p>
            <p className="pl-5">1. If email verification is enabled on your server, click the link sent to your inbox.</p>
            <p className="pl-5">2. If email confirmation is disabled/auto-confirmed, you can log in immediately.</p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('login')}
              type="button"
              className="w-full py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-hover text-surface font-semibold text-sm transition-all focus-ring cursor-pointer"
            >
              Go to Log In
            </button>
          </div>
        </div>
      ) : (
        /* Signup Form State */
        <form onSubmit={validateAndSubmit} className="space-y-4" noValidate>
          
          {/* Form Error Banner */}
          {formErrorBanner && (
            <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-xs text-emergency flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Registration Failed</p>
                <p className="mt-0.5">{formErrorBanner}</p>
              </div>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <label htmlFor="signup-name" className="text-xs font-semibold text-ink uppercase tracking-wider block">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                }}
                placeholder="e.g. Alex Morgan"
                className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
              />
            </div>
            <div className="min-h-[18px]">
              {errors.fullName && <p className="text-xs font-medium text-emergency">{errors.fullName}</p>}
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <label htmlFor="signup-email" className="text-xs font-semibold text-ink uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                placeholder={`username${ALLOWED_EMAIL_DOMAIN}`}
                className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
              />
            </div>
            <p className="text-[12px] text-ink-muted flex items-center gap-1 pt-0.5">
              <Info className="w-3.5 h-3.5 text-medical shrink-0" />
              <span>Must end with <strong className="text-ink font-mono font-medium">{ALLOWED_EMAIL_DOMAIN}</strong></span>
            </p>
            <div className="min-h-[18px]">
              {errors.email && <p className="text-xs font-medium text-emergency">{errors.email}</p>}
            </div>
          </div>

          {/* Student ID & Department Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Student ID */}
            <div className="space-y-1">
              <label htmlFor="signup-id" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                Student ID
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                <input
                  id="signup-id"
                  type="text"
                  value={universityId}
                  onChange={(e) => {
                    setUniversityId(e.target.value);
                    if (errors.universityId) setErrors(prev => ({ ...prev, universityId: '' }));
                  }}
                  placeholder="e.g. 90384102"
                  className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                />
              </div>
              <div className="min-h-[18px]">
                {errors.universityId && <p className="text-xs font-medium text-emergency">{errors.universityId}</p>}
              </div>
            </div>

            {/* Department (Optional) */}
            <div className="space-y-1">
              <label htmlFor="signup-dept" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                Department <span className="normal-case text-ink-muted font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                <input
                  id="signup-dept"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                />
              </div>
            </div>

          </div>

          {/* Phone Number (Optional) */}
          <div className="space-y-1">
            <label htmlFor="signup-phone" className="text-xs font-semibold text-ink uppercase tracking-wider block">
              Contact Phone <span className="normal-case text-ink-muted font-normal">(Optional, for emergency SMS)</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
              <input
                id="signup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1700-000000"
                className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
              />
            </div>
          </div>

          {/* Password & Confirm Password Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="signup-password" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                  }}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-8 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-3.5 text-ink-muted hover:text-ink focus-ring rounded-md p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="min-h-[18px]">
                {errors.password && <p className="text-xs font-medium text-emergency">{errors.password}</p>}
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label htmlFor="signup-confirm-password" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="Repeat password"
                  className="w-full pl-10 pr-4 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
                />
              </div>
              <div className="min-h-[18px]">
                {errors.confirmPassword && <p className="text-xs font-medium text-emergency">{errors.confirmPassword}</p>}
              </div>
            </div>

          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl bg-warm-accent hover:bg-warm-accent-hover text-ink font-semibold text-sm transition-all shadow-xs focus-ring flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-ink" />
                  <span>Registering Account...</span>
                </>
              ) : (
                <>
                  <span>Sign Up Account</span>
                  <ArrowRight className="w-4 h-4 text-ink" />
                </>
              )}
            </button>
          </div>

          {/* Admin / Doctor Quiet Notice */}
          <div className="p-3.5 rounded-xl bg-background/80 border border-border/70 text-xs text-ink-muted flex items-start gap-2.5 mt-4">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Doctor and Admin accounts are created by university administration. Contact your department if you need staff access.
            </p>
          </div>

          {/* Bottom Switch Link */}
          <div className="text-center pt-4 text-xs text-ink-muted border-t border-border mt-4 space-y-2">
            <div>
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="font-semibold text-primary hover:text-primary-hover underline underline-offset-4 focus-ring rounded-xs"
              >
                Log In
              </button>
            </div>
            <div>
              <span>Are you a medical provider? </span>
              <button
                type="button"
                onClick={() => onNavigate('doctor/request-access')}
                className="font-semibold text-medical hover:underline focus-ring rounded-xs"
              >
                Request Doctor Access
              </button>
            </div>
          </div>

        </form>
      )}
    </AuthLayout>
  );
};

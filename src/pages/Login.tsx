import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Info, AlertTriangle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { PageRoute } from '../types';
import { useAuth } from '../context/AuthContext';
import { ALLOWED_EMAIL_DOMAIN, isValidUniversityEmail } from '../lib/config';

interface LoginPageProps {
  onNavigate: (route: PageRoute) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Validation error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formErrorBanner, setFormErrorBanner] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setFormErrorBanner(null);

    let hasError = false;
    const cleanEmail = email.trim();

    // 1. Email validation
    if (!cleanEmail) {
      setEmailError('University email is required.');
      hasError = true;
    } else if (!cleanEmail.includes('@')) {
      setEmailError('Please enter a valid email address.');
      hasError = true;
    } else if (!isValidUniversityEmail(cleanEmail)) {
      setEmailError('Please use your official email address');
      hasError = true;
    }

    // 2. Password validation
    if (!password) {
      setPasswordError('Password is required.');
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      const result = await login(cleanEmail, password);

      setIsLoading(false);

      if (result.success) {
        // AuthContext / App.tsx will automatically redirect upon session change
      } else {
        setFormErrorBanner(result.error || 'Incorrect email or password.');
      }
    } catch (err: any) {
      setIsLoading(false);
      console.warn('[Login Form Exception]:', err?.message || err);
      setFormErrorBanner('An error occurred during authentication. Please try again.');
    }
  };

  return (
    <AuthLayout
      title="Log In"
      subtitle={`Access your university medical scheduling & SOS portal using your ${ALLOWED_EMAIL_DOMAIN} account.`}
      mode="login"
      onNavigate={onNavigate}
    >
      <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
        
        {/* Error Banner */}
        {formErrorBanner && (
          <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-xs text-emergency flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Authentication Failed</p>
              <p className="mt-0.5">{formErrorBanner}</p>
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1">
          <label htmlFor="login-email" className="text-xs font-semibold text-ink uppercase tracking-wider block">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
                if (formErrorBanner) setFormErrorBanner(null);
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
            {emailError && (
              <p className="text-xs font-medium text-emergency flex items-center gap-1">
                <span>{emailError}</span>
              </p>
            )}
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-xs font-semibold text-ink uppercase tracking-wider block">
              Password
            </label>
            <button
              type="button"
              onClick={() => alert('Password reset link will be sent to your official university email.')}
              className="text-xs font-medium text-ink-muted hover:text-primary transition-colors focus-ring rounded-xs"
            >
              Forgot password?
            </button>
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError('');
                if (formErrorBanner) setFormErrorBanner(null);
              }}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-10 py-3 bg-background rounded-xl border border-border text-sm text-ink focus:border-primary focus:bg-surface focus-ring transition-all placeholder:text-ink-muted/60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3.5 text-ink-muted hover:text-ink focus-ring rounded-md p-0.5"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="min-h-[18px]">
            {passwordError && (
              <p className="text-xs font-medium text-emergency">
                {passwordError}
              </p>
            )}
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
                <span>Authenticating with University SSO...</span>
              </>
            ) : (
              <>
                <span>Log In & Open Dashboard</span>
                <ArrowRight className="w-4 h-4 text-ink" />
              </>
            )}
          </button>
        </div>

        {/* Quick Credentials Fill (Helper for quick testing) */}
        <div className="p-3 bg-surface rounded-xl border border-border/80 space-y-2">
          <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-center">
            Quick Fill Test Accounts (@diu.edu.bd)
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail('sokal@diu.edu.bd');
                setPassword('Password123!');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-primary/10 text-ink hover:text-primary font-medium text-center border border-border/60 transition-colors cursor-pointer"
            >
              🎓 Student (sokal)
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('mishad242-35-739@diu.edu.bd');
                setPassword('Password123!');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-primary/10 text-ink hover:text-primary font-medium text-center border border-border/60 transition-colors cursor-pointer"
            >
              🎓 Student (mishad)
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('doctor@diu.edu.bd');
                setPassword('Password123!');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-medical/10 text-ink hover:text-medical font-medium text-center border border-border/60 transition-colors cursor-pointer"
            >
              🩺 Doctor
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('superadmin@diu.edu.bd');
                setPassword('Password123!');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-primary/10 text-ink hover:text-primary font-medium text-center border border-border/60 transition-colors cursor-pointer"
            >
              ⚡ Super Admin
            </button>
          </div>
        </div>

        {/* Bottom Switch Note */}
        <div className="text-center pt-4 text-xs text-ink-muted border-t border-border mt-6 space-y-2">
          <div>
            <span>Don't have an account? </span>
            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="font-semibold text-primary hover:text-primary-hover underline underline-offset-4 focus-ring rounded-xs"
            >
              Sign Up
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
    </AuthLayout>
  );
};

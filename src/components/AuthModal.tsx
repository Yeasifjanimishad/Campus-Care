import React, { useState } from 'react';
import { X, Mail, Lock, Shield, ArrowRight } from 'lucide-react';
import { UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  mode: 'login' | 'signup';
  onClose: () => void;
  onSwitchMode: (mode: 'login' | 'signup') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
}) => {
  const [role, setRole] = useState<UserRole>('student_faculty');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setEmail('');
    setError('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-ink-muted hover:text-ink focus-ring rounded-lg"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <h2 className="font-heading font-bold text-2xl text-ink">
            {mode === 'login' ? 'Log In to CampusCare' : 'Sign Up with Email'}
          </h2>
          <p className="text-sm text-ink-muted">
            Access medical scheduling and emergency tools using your verified .edu account.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
                Select Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'student_faculty', label: 'Student / Faculty' },
                    { id: 'doctor', label: 'Doctor' },
                    { id: 'emergency_admin', label: 'Emergency Admin' },
                    { id: 'super_admin', label: 'Super Admin' },
                  ] as { id: UserRole; label: string }[]
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors focus-ring ${
                      role === r.id
                        ? 'bg-primary text-surface border-primary'
                        : 'bg-background border-border text-ink-muted hover:border-primary'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-email" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                University Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
                <input
                  id="modal-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full pl-9 pr-4 py-2.5 bg-background rounded-lg border border-border text-sm text-ink focus:border-primary focus-ring"
                />
              </div>
              {error && <p className="text-xs text-emergency">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-password" className="text-xs font-semibold text-ink uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
                <input
                  id="modal-password"
                  type="password"
                  defaultValue="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-background rounded-lg border border-border text-sm text-ink focus:border-primary focus-ring"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg bg-primary hover:bg-primary-hover text-surface font-semibold text-sm transition-colors flex items-center justify-center gap-2 focus-ring"
            >
              <span>{mode === 'login' ? 'Log In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center text-xs text-ink-muted pt-2">
              {mode === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button type="button" onClick={() => onSwitchMode('signup')} className="text-primary font-semibold hover:underline">
                    Sign up
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{' '}
                  <button type="button" onClick={() => onSwitchMode('login')} className="text-primary font-semibold hover:underline">
                    Log in
                  </button>
                </span>
              )}
            </div>

          </form>
        ) : (
          <div className="text-center py-4 space-y-4">
            <div className="w-10 h-10 rounded-full bg-wellness/10 text-wellness mx-auto flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-semibold text-lg text-ink">
                SSO Verification Sent
              </h3>
              <p className="text-xs text-ink-muted">
                A verification link has been dispatched to <strong className="text-ink">{email}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2.5 px-4 rounded-lg border border-border text-xs font-medium text-ink hover:bg-background"
            >
              Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

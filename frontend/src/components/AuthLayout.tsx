import React from 'react';
import { ShieldCheck, Heart, Stethoscope, Lock, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  mode: 'login' | 'signup';
  onNavigate: (route: 'landing' | 'login' | 'signup') => void;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  mode,
  onNavigate,
  children,
}) => {
  return (
    <div className="relative min-h-screen bg-background text-ink font-body flex flex-col selection:bg-medical/20 selection:text-ink overflow-hidden">

      {/* Ambient Aurora Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="aurora-blob animate-aurora w-[480px] h-[480px] bg-medical/25 -top-32 -left-24" />
        <div className="aurora-blob animate-aurora-slow w-[420px] h-[420px] bg-wellness/20 bottom-0 -right-24" />
        <div className="aurora-blob animate-aurora w-[320px] h-[320px] bg-warm-accent/15 top-1/2 left-1/3" />
      </div>

      {/* Simplified Header for Auth Pages */}
      <header className="glass-nav sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 sm:h-20">
            
            {/* Wordmark with Back to Home Link */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate('landing')}
                type="button"
                className="p-2 text-ink-muted hover:text-primary hover:bg-white/60 rounded-lg transition-colors focus-ring"
                title="Return to Home"
                aria-label="Return to Home"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigate('landing')}
                type="button"
                className="focus-ring rounded-md text-left"
              >
                <span className="font-heading font-bold text-2xl tracking-tight text-primary">
                  Campus<span className="text-medical">Care</span>
                </span>
              </button>
            </div>

            {/* Quick Toggle Link */}
            <div className="text-sm">
              {mode === 'login' ? (
                <span className="text-ink-muted">
                  New to CampusCare?{' '}
                  <button
                    onClick={() => onNavigate('signup')}
                    type="button"
                    className="font-semibold text-primary hover:text-primary-hover underline underline-offset-4 focus-ring rounded-xs"
                  >
                    Sign Up
                  </button>
                </span>
              ) : (
                <span className="text-ink-muted">
                  Already have an account?{' '}
                  <button
                    onClick={() => onNavigate('login')}
                    type="button"
                    className="font-semibold text-primary hover:text-primary-hover underline underline-offset-4 focus-ring rounded-xs"
                  >
                    Log In
                  </button>
                </span>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel w-full rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]"
        >
          
          {/* Left / Top Side: Flat Vector Illustration Panel */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0B2A3B] via-[#1B4B66] to-[#2E7DAF] p-8 lg:p-12 text-surface flex flex-col justify-between relative overflow-hidden">
            
            {/* Decorative Vector Graphic Background Elements */}
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-illustration-blue/30 blur-2xl pointer-events-none animate-aurora" />
            <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 rounded-full bg-warm-accent/25 blur-2xl pointer-events-none animate-aurora-slow" />

            {/* Top Brand Tag */}
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface/15 backdrop-blur-md text-xs font-semibold tracking-wide text-surface border border-surface/20">
                <ShieldCheck className="w-3.5 h-3.5 text-warm-accent" />
                <span>Verified .edu Portal</span>
              </div>
              <h2 className="font-heading font-bold text-2xl lg:text-3xl text-surface leading-tight pt-2">
                {mode === 'login'
                  ? 'Welcome back to your campus health hub.'
                  : 'Join your university’s dedicated health & emergency network.'}
              </h2>
            </div>

            {/* Central Flat Vector Graphic (Custom SVG Illustration) */}
            <div className="relative z-10 py-8 my-auto flex flex-col items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="glass-dark w-full max-w-xs relative aspect-4/3 rounded-2xl p-6 flex flex-col justify-between"
              >
                
                {/* Floating Badge 1 */}
                <div className="absolute -top-4 -left-3 bg-surface text-ink px-3 py-1.5 rounded-xl border border-border shadow-sm flex items-center gap-2 text-xs font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-medical/15 flex items-center justify-center text-medical">
                    <Stethoscope className="w-3.5 h-3.5" />
                  </div>
                  <span>Medical Care</span>
                </div>

                {/* Floating Badge 2 */}
                <div className="absolute -bottom-3 -right-3 bg-surface text-ink px-3 py-1.5 rounded-xl border border-border shadow-sm flex items-center gap-2 text-xs font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-wellness/15 flex items-center justify-center text-wellness">
                    <Heart className="w-3.5 h-3.5" />
                  </div>
                  <span>Wellness & SOS</span>
                </div>

                {/* Center Vector Artwork Graphics */}
                <svg
                  viewBox="0 0 240 140"
                  className="w-full h-auto drop-shadow-sm"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Person with phone/tablet vector drawing */}
                  {/* Background Shield */}
                  <path
                    d="M120 15 L180 35 V75 C180 110 120 130 120 130 C120 130 60 110 60 75 V35 L120 15 Z"
                    fill="#29ABE2"
                    fillOpacity="0.25"
                    stroke="#29ABE2"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  {/* Student Avatar */}
                  <circle cx="120" cy="55" r="22" fill="#FFFFFF" />
                  <circle cx="120" cy="50" r="10" fill="#1B4B66" />
                  <path
                    d="M100 82 C100 70 108 65 120 65 C132 65 140 70 140 82 V88 H100 V82 Z"
                    fill="#1B4B66"
                  />
                  {/* Phone / Security Token */}
                  <rect x="145" y="45" width="28" height="48" rx="5" fill="#F2A65A" />
                  <rect x="149" y="50" width="20" height="34" rx="2" fill="#FFFFFF" />
                  <path d="M155 60 L163 68 L170 56" stroke="#3FA796" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Lock Indicator */}
                  <circle cx="85" cy="70" r="14" fill="#3FA796" />
                  <path d="M81 72 H89 V77 H81 V72 Z M83 72 V69 C83 67 87 67 87 69 V72" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
                </svg>

                <div className="text-center pt-2">
                  <span className="text-xs text-surface/90 font-medium">
                    {mode === 'login' ? 'Single Sign-On Authentication' : 'Instant Student & Staff Enrollment'}
                  </span>
                </div>

              </motion.div>
            </div>

            {/* Bottom Trust Note */}
            <div className="relative z-10 pt-4 border-t border-surface/20 flex items-center justify-between text-xs text-surface/80">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-warm-accent" />
                <span>FERPA & HIPAA Compliant</span>
              </div>
              <span className="font-mono text-[11px] text-illustration-blue">SSO v2.4</span>
            </div>

          </div>

          {/* Right / Main Side: Form Container */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-14 flex flex-col justify-center bg-white/40 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-md w-full mx-auto space-y-6"
            >
              
              {/* Form Title & Subtitle */}
              <div className="space-y-1.5">
                <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink">
                  {title}
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {subtitle}
                </p>
              </div>

              {/* Form Content Passed as Children */}
              {children}

            </motion.div>
          </div>

        </motion.div>
      </main>

      {/* Simplified Footer */}
      <footer className="relative z-10 glass-panel border-t-0 py-4 text-xs text-ink-muted mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} CampusCare Platform. University Health Services.</span>
          <div className="flex items-center space-x-4">
            <button onClick={() => onNavigate('landing')} type="button" className="hover:text-primary">
              Privacy Protocol
            </button>
            <button onClick={() => onNavigate('landing')} type="button" className="hover:text-primary">
              System Status
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};

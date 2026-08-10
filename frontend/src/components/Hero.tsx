import React, { useRef, useEffect } from 'react';
import { ArrowRight, ShieldCheck, CheckCircle2, HeartPulse, Activity, Stethoscope } from 'lucide-react';
import { motion } from 'motion/react';
import gsap from 'gsap';

interface HeroProps {
  onGetStarted: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onGetStarted }) => {
  const floatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!floatRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.hero-float', {
        y: -14,
        duration: 3,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.4,
      });
    }, floatRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative min-h-[600px] lg:min-h-[680px] flex items-center overflow-hidden bg-gradient-to-br from-[#0B2A3B] via-[#1B4B66] to-[#0F3D53]">
      {/* Aurora Gradient Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="aurora-blob animate-aurora w-[520px] h-[520px] bg-medical/50 -top-40 -left-32" />
        <div className="aurora-blob animate-aurora-slow w-[460px] h-[460px] bg-wellness/40 top-1/3 -right-24" />
        <div className="aurora-blob animate-aurora w-[380px] h-[380px] bg-warm-accent/30 -bottom-32 left-1/3" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-20 lg:py-28 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left: Headline & CTA */}
        <div className="lg:col-span-7 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <span className="glass-dark inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white/90 tracking-wide">
              <Activity className="w-3.5 h-3.5 text-warm-accent" />
              <span>Campus Health &amp; Safety, Reimagined</span>
            </span>

            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.08] tracking-tight">
              Unified health &amp; safety for the{' '}
              <span className="text-gradient-light">modern campus.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/80 leading-relaxed font-normal max-w-xl">
              Connect with university medical services, manage student wellness, and access direct emergency response in one secure portal.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center gap-4 pt-2"
          >
            <motion.button
              onClick={onGetStarted}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-semibold text-ink bg-warm-accent hover:bg-warm-accent-hover rounded-2xl shadow-lg shadow-warm-accent/25 transition-colors focus-ring cursor-pointer"
            >
              <span>Sign Up with Email</span>
              <ArrowRight className="w-5 h-5 text-ink" />
            </motion.button>

            <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-white/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-warm-accent" />
                <span>FERPA &amp; HIPAA Aligned</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-wellness" />
                <span>Verified Single Sign-On (.edu)</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right: Floating Glass Cards */}
        <motion.div
          ref={floatRef}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 relative hidden lg:flex items-center justify-center min-h-[380px]"
        >
          <div className="hero-float glass-dark rounded-3xl p-6 w-72 absolute top-4 left-4 rotate-[-3deg]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-medical/30 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-sky-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Dr. Appointment</p>
                <p className="text-xs text-white/60">Today · 2:30 PM</p>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-sky-400 to-teal-300" />
            </div>
            <p className="text-[11px] text-white/50 mt-2">Confirmed with Student Health Center</p>
          </div>

          <div className="hero-float glass-dark rounded-3xl p-6 w-64 absolute bottom-6 right-2 rotate-[2deg]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emergency/30 flex items-center justify-center">
                <HeartPulse className="w-5 h-5 text-rose-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Emergency SOS</p>
                <p className="text-xs text-white/60">1-tap campus dispatch</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-white/60">Responders online · avg 3 min</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

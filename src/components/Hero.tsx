import React from 'react';
import { ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface HeroProps {
  onGetStarted: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onGetStarted }) => {
  return (
    <section className="relative min-h-[540px] lg:min-h-[600px] flex items-center overflow-hidden border-b border-border bg-primary">
      {/* Background Campus Photo with Gradient Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1920&q=80"
          alt="University campus medical center and students"
          className="w-full h-full object-cover object-center scale-105 transition-transform duration-1000"
        />
        {/* Navy to Medical Blue Gradient Overlay for High Contrast AA Text */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B4B66]/95 via-[#1B4B66]/85 to-[#2E7DAF]/75" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16 lg:py-24 w-full">
        <div className="max-w-2xl space-y-8">
          
          {/* Main Headline */}
          <div className="space-y-4">
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-surface leading-[1.1] tracking-tight drop-shadow-xs">
              Unified health & safety for the modern campus.
            </h1>

            <p className="text-lg sm:text-xl text-surface/90 leading-relaxed font-normal max-w-xl">
              Connect with university medical services, manage student wellness, and access direct emergency response in one secure portal.
            </p>
          </div>

          {/* ONE Primary CTA Button in Warm Accent (#F2A65A) */}
          <div className="pt-2">
            <button
              onClick={onGetStarted}
              type="button"
              className="inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-semibold text-ink bg-warm-accent hover:bg-warm-accent-hover rounded-xl shadow-md hover:shadow-lg transition-all focus-ring active:scale-[0.99] cursor-pointer"
            >
              <span>Sign Up with Email</span>
              <ArrowRight className="w-5 h-5 text-ink" />
            </button>
          </div>

          {/* Verification line */}
          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-medium text-surface/80">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-warm-accent" />
              <span>FERPA & HIPAA Aligned</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-wellness" />
              <span>Verified Single Sign-On (.edu)</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

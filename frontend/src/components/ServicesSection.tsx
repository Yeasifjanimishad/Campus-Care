import React, { useRef, useEffect } from 'react';
import { Stethoscope, ShieldAlert, HeartHandshake, FileText, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ServicesSectionProps {
  onSelectService?: (id: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onSelectService }) => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.service-card', {
        y: 48,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          once: true,
        },
      });
      gsap.from('.services-header', {
        y: 32,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          once: true,
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const services = [
    {
      id: 'medical-appointments',
      title: 'Medical Appointments',
      description: 'Schedule same-day visits with campus physicians and nurses for general health, routine care, and prescriptions.',
      category: 'Medical Care',
      accentColor: 'text-medical bg-medical/10 border-medical/20',
      glow: 'from-medical/25',
      icon: Stethoscope,
      imageUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'emergency-sos',
      title: 'Emergency SOS',
      description: 'Direct 1-tap distress alert to campus police and emergency responders with precise building location tracking.',
      category: 'Emergency SOS',
      accentColor: 'text-emergency bg-emergency/10 border-emergency/20',
      glow: 'from-emergency/25',
      icon: ShieldAlert,
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'counseling-wellness',
      title: 'Counseling & Wellness',
      description: 'Confidential mental health consultations, crisis support, and wellness resources tailored for university students.',
      category: 'Wellness',
      accentColor: 'text-wellness bg-wellness/10 border-wellness/20',
      glow: 'from-wellness/25',
      icon: HeartHandshake,
      imageUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'health-records',
      title: 'Health Records',
      description: 'Encrypted storage for immunization status, lab results, and medical notes verified by student health services.',
      category: 'Medical Records',
      accentColor: 'text-medical bg-medical/10 border-medical/20',
      glow: 'from-medical/25',
      icon: FileText,
      imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative py-16 md:py-24 overflow-hidden bg-gradient-to-b from-background via-medical-light/30 to-background"
    >
      {/* Ambient blobs */}
      <div className="aurora-blob animate-aurora-slow w-[420px] h-[420px] bg-medical/20 -top-24 -right-32" />
      <div className="aurora-blob animate-aurora w-[360px] h-[360px] bg-wellness/20 bottom-0 -left-24" />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        
        {/* Section Header */}
        <div className="services-header text-center max-w-2xl mx-auto space-y-3">
          <h2 className="font-heading font-bold text-3xl sm:text-4xl">
            <span className="text-gradient">Campus Health &amp; Safety Services</span>
          </h2>
          <p className="text-base text-ink-muted">
            Access certified campus care modules color-coded by medical, emergency, and counseling services.
          </p>
        </div>

        {/* 4 Glass Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => onSelectService?.(service.id)}
                className="service-card glass-card relative overflow-hidden flex flex-col justify-between group cursor-pointer hover:-translate-y-1.5 transition-transform duration-300"
              >
                {/* Accent glow */}
                <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${service.glow} to-transparent blur-2xl opacity-70 pointer-events-none`} />

                <div>
                  {/* Photo Header */}
                  <div className="h-36 relative overflow-hidden rounded-t-[1.25rem]">
                    <img
                      src={service.imageUrl}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/30 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className={`glass-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${service.accentColor}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span>{service.category}</span>
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-2 relative">
                    <h3 className="font-heading font-semibold text-xl text-ink group-hover:text-primary transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-sm text-ink-muted leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2 text-xs font-semibold text-primary flex items-center justify-between relative">
                  <span>Learn more</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

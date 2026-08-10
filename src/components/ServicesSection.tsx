import React from 'react';
import { Stethoscope, ShieldAlert, HeartHandshake, FileText } from 'lucide-react';

interface ServicesSectionProps {
  onSelectService?: (id: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onSelectService }) => {
  const services = [
    {
      id: 'medical-appointments',
      title: 'Medical Appointments',
      description: 'Schedule same-day visits with campus physicians and nurses for general health, routine care, and prescriptions.',
      category: 'Medical Care',
      accentColor: 'border-medical text-medical bg-medical/10',
      topBorder: 'border-t-4 border-t-medical',
      icon: Stethoscope,
      imageUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'emergency-sos',
      title: 'Emergency SOS',
      description: 'Direct 1-tap distress alert to campus police and emergency responders with precise building location tracking.',
      category: 'Emergency SOS',
      accentColor: 'border-emergency text-emergency bg-emergency/10',
      topBorder: 'border-t-4 border-t-emergency',
      icon: ShieldAlert,
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'counseling-wellness',
      title: 'Counseling & Wellness',
      description: 'Confidential mental health consultations, crisis support, and wellness resources tailored for university students.',
      category: 'Wellness',
      accentColor: 'border-wellness text-wellness bg-wellness/10',
      topBorder: 'border-t-4 border-t-wellness',
      icon: HeartHandshake,
      imageUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'health-records',
      title: 'Health Records',
      description: 'Encrypted storage for immunization status, lab results, and medical notes verified by student health services.',
      category: 'Medical Records',
      accentColor: 'border-medical text-medical bg-medical/10',
      topBorder: 'border-t-4 border-t-medical',
      icon: FileText,
      imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <section id="services" className="py-16 md:py-24 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-ink">
            Campus Health & Safety Services
          </h2>
          <p className="text-base text-ink-muted">
            Access certified campus care modules color-coded by medical, emergency, and counseling services.
          </p>
        </div>

        {/* 4 Color-Coded Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                onClick={() => onSelectService?.(service.id)}
                className={`bg-background rounded-2xl border border-border shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between ${service.topBorder} group cursor-pointer`}
              >
                <div>
                  {/* Small Photo Header */}
                  <div className="h-36 relative overflow-hidden bg-border/40">
                    <img
                      src={service.imageUrl}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-surface/95 backdrop-blur-xs shadow-2xs ${service.accentColor}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span>{service.category}</span>
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-2">
                    <h3 className="font-heading font-semibold text-xl text-ink group-hover:text-primary transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-sm text-ink-muted leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2 text-xs font-semibold text-primary group-hover:underline flex items-center justify-between">
                  <span>Learn more</span>
                  <span className="text-base">→</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

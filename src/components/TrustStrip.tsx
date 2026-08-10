import React from 'react';
import { ShieldCheck, Clock, Lock } from 'lucide-react';

export const TrustStrip: React.FC = () => {
  const trustItems = [
    {
      id: 'access',
      title: 'University-Verified Access',
      description: 'Exclusive to enrolled students, faculty, and staff via single sign-on.',
      icon: ShieldCheck,
      iconColor: 'text-primary',
    },
    {
      id: 'emergency',
      title: '24/7 Emergency Response',
      description: 'Direct location-pinned dispatch to campus police and medical first responders.',
      icon: Clock,
      iconColor: 'text-emergency',
    },
    {
      id: 'records',
      title: 'Confidential Records',
      description: 'Encrypted medical notes and counseling records complying with FERPA & HIPAA standards.',
      icon: Lock,
      iconColor: 'text-wellness',
    },
  ];

  return (
    <section className="py-14 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-border">
                <div className="p-3 rounded-lg bg-background border border-border shrink-0">
                  <Icon className={`w-6 h-6 ${item.iconColor}`} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-heading font-semibold text-base text-ink">
                    {item.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

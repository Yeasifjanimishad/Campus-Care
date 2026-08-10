import React from 'react';
import { ShieldCheck, Clock, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export const TrustStrip: React.FC = () => {
  const trustItems = [
    {
      id: 'access',
      title: 'University-Verified Access',
      description: 'Exclusive to enrolled students, faculty, and staff via single sign-on.',
      icon: ShieldCheck,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      id: 'emergency',
      title: '24/7 Emergency Response',
      description: 'Direct location-pinned dispatch to campus police and medical first responders.',
      icon: Clock,
      iconColor: 'text-emergency',
      iconBg: 'bg-emergency/10',
    },
    {
      id: 'records',
      title: 'Confidential Records',
      description: 'Encrypted medical notes and counseling records complying with FERPA & HIPAA standards.',
      icon: Lock,
      iconColor: 'text-wellness',
      iconBg: 'bg-wellness/10',
    },
  ];

  return (
    <section id="safety" className="relative py-14 overflow-hidden">
      <div className="aurora-blob animate-aurora w-[320px] h-[320px] bg-warm-accent/15 top-0 right-1/4" />
      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {trustItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="glass-card flex items-start gap-4 p-5"
              >
                <div className={`p-3 rounded-2xl ${item.iconBg} shrink-0`}>
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
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

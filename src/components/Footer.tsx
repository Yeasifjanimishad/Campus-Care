import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-background border-t border-border py-8 text-xs text-ink-muted">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Wordmark & Copyright */}
        <div className="flex items-center gap-3">
          <span className="font-heading font-bold text-base text-primary">
            Campus<span className="text-medical">Care</span>
          </span>
          <span className="text-border">|</span>
          <span>&copy; {new Date().getFullYear()} CampusCare Platform</span>
        </div>

        {/* Minimal Nav Links */}
        <div className="flex items-center space-x-6 font-medium">
          <a href="#" className="hover:text-primary transition-colors">Privacy Protocol</a>
          <a href="#" className="hover:text-primary transition-colors">System Status</a>
          <a href="#" className="hover:text-primary transition-colors">Compliance</a>
        </div>

      </div>
    </footer>
  );
};

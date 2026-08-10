import React, { useState } from 'react';
import { Menu, X, LayoutDashboard, HeartPulse } from 'lucide-react';
import { Button } from './ui/Button';

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onNavigateDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, onNavigateDashboard }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Services', href: '#services' },
    { label: 'Safety', href: '#safety' },
    { label: 'Resources', href: '#resources' },
  ];

  return (
    <header className="bg-surface/90 backdrop-blur-md border-b border-border sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Wordmark */}
          <a href="#" className="focus-ring rounded-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5 text-medical" />
            </div>
            <span className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-primary">
              Campus<span className="text-medical">Care</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-ink-muted hover:text-primary transition-colors focus-ring rounded-md px-1 py-0.5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Auth Actions */}
          <div className="hidden md:flex items-center space-x-3">
            {onNavigateDashboard && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onNavigateDashboard}
                leftIcon={<LayoutDashboard className="w-4 h-4 text-primary" />}
              >
                App Dashboard
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAuth('login')}
            >
              Log In
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenAuth('signup')}
            >
              Sign Up
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="p-2 text-ink-muted hover:text-ink focus-ring rounded-xl border border-border"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-surface px-6 py-4 space-y-4 animate-in fade-in duration-150">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-ink py-1.5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-3 border-t border-border flex flex-col space-y-2">
            {onNavigateDashboard && (
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateDashboard();
                }}
                leftIcon={<LayoutDashboard className="w-4 h-4" />}
              >
                Open Dashboard Shell
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('login');
              }}
            >
              Log In
            </Button>
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('signup');
              }}
            >
              Sign Up
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};


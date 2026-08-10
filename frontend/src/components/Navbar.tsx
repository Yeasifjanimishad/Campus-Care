import React, { useState } from 'react';
import { Menu, X, LayoutDashboard, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';
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
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-3 sm:top-4 z-30 px-3 sm:px-6"
    >
      <div className="glass-nav max-w-6xl mx-auto rounded-2xl sm:rounded-3xl px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          
          {/* Wordmark */}
          <a href="#" className="focus-ring rounded-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-medical to-wellness text-white flex items-center justify-center shrink-0 shadow-sm">
              <HeartPulse className="w-5 h-5 text-white" />
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
                className="text-sm font-semibold text-ink-muted hover:text-primary transition-colors focus-ring rounded-full px-3 py-1.5 hover:bg-white/60"
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
              className="p-2 text-ink-muted hover:text-ink focus-ring rounded-xl glass-chip"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="md:hidden glass-nav max-w-6xl mx-auto mt-2 rounded-2xl px-6 py-4 space-y-4"
        >
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
        </motion.div>
      )}
    </motion.header>
  );
};


import React from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { ServicesSection } from '../components/ServicesSection';
import { TrustStrip } from '../components/TrustStrip';
import { Footer } from '../components/Footer';
import { PageRoute } from '../types';

interface LandingPageProps {
  onNavigate: (route: PageRoute) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-background text-ink font-body flex flex-col selection:bg-medical/20 selection:text-ink">
      
      {/* Header */}
      <Navbar 
        onOpenAuth={(mode) => onNavigate(mode)} 
        onNavigateDashboard={() => onNavigate('dashboard')}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* Photo-style Hero with Gradient Overlay & Warm Accent CTA */}
        <Hero onGetStarted={() => onNavigate('signup')} />

        {/* 4 Color-Coded Module Services Cards */}
        <ServicesSection onSelectService={() => onNavigate('signup')} />

        {/* Trust & Stats Strip */}
        <TrustStrip />
      </main>

      {/* Minimal Footer */}
      <Footer />

    </div>
  );
};

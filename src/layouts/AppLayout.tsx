import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { AppNavId, UserProfile } from '../types';

interface AppLayoutProps {
  activeNav: AppNavId;
  onNavChange: (nav: AppNavId) => void;
  user?: UserProfile;
  onLogout: () => void;
  children: React.ReactNode;
}

const defaultUser: UserProfile = {
  name: 'Alex Morgan',
  email: 'alex.morgan@university.edu',
  role: 'student_faculty',
  roleLabel: 'Student / Faculty',
  initials: 'AM',
  universityId: '90384102',
};

const navTitles: Record<AppNavId, string> = {
  dashboard: 'Dashboard',
  appointments: 'Medical Appointments',
  alerts: 'Emergency Alerts & SOS',
  reports: 'Campus Incident Reports',
  records: 'Health & Clinical Records',
  notifications: 'Campus Announcements & Notifications',
  profile: 'Student Profile & Settings',
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeNav,
  onNavChange,
  user = defaultUser,
  onLogout,
  children,
}) => {
  return (
    <div className="min-h-screen bg-background text-ink font-body selection:bg-medical/20 selection:text-ink">
      
      {/* Desktop Sidebar (>=768px) */}
      <div className="hidden md:block">
        <Sidebar
          activeNav={activeNav}
          onNavChange={onNavChange}
          user={user}
          onLogout={onLogout}
        />
      </div>

      {/* Main Content Shell (Pushed right on desktop to clear sidebar) */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        
        {/* TopBar Header */}
        <TopBar
          title={navTitles[activeNav] || 'Dashboard'}
          user={user}
          onNotificationClick={() => onNavChange('notifications')}
          onProfileClick={() => onNavChange('profile')}
          onLogout={onLogout}
        />

        {/* Scrollable Main Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {children}
        </main>

      </div>

      {/* Mobile Bottom Navigation (<768px) */}
      <BottomNav
        activeNav={activeNav}
        onNavChange={onNavChange}
      />

    </div>
  );
};

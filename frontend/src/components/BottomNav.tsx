import React from 'react';
import { LayoutDashboard, CalendarDays, Bell, User, FileText, Activity, Megaphone } from 'lucide-react';
import { AppNavId } from '../types';

interface BottomNavProps {
  activeNav: AppNavId;
  onNavChange: (nav: AppNavId) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeNav, onNavChange }) => {
  const navItems = [
    { id: 'dashboard' as AppNavId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments' as AppNavId, label: 'Care', icon: CalendarDays },
    { id: 'alerts' as AppNavId, label: 'SOS Alert', icon: Bell },
    { id: 'records' as AppNavId, label: 'Records', icon: Activity },
    { id: 'profile' as AppNavId, label: 'Profile', icon: User },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border shadow-lg px-1 py-1.5 flex items-center justify-around h-16 selection:bg-none"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeNav === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onNavChange(item.id)}
            type="button"
            className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 text-xs font-semibold transition-all relative focus-ring rounded-xl cursor-pointer ${
              isActive
                ? 'text-primary font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary scale-110' : 'text-ink-muted'} transition-transform duration-150`} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">{item.label}</span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-0.5" />
            )}
          </button>
        );
      })}
    </nav>
  );
};


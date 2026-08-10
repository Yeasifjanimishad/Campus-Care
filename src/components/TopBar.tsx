import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AppNavId } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { 
  User, 
  LogOut, 
  ChevronDown, 
  ShieldCheck, 
  Building, 
  Mail, 
  IdCard,
  Settings,
  Bell
} from 'lucide-react';
import { StatusBadge } from './ui/StatusBadge';

interface TopBarProps {
  title: string;
  user: UserProfile;
  unreadCount?: number;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  user,
  onNotificationClick,
  onProfileClick,
  onLogout,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'emergency_admin':
        return 'danger';
      case 'doctor':
        return 'info';
      default:
        return 'success';
    }
  };

  return (
    <header className="h-16 sm:h-20 bg-surface border-b border-border sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-2xs">
      
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile brand mark (visible on small screens only) */}
        <div className="md:hidden flex items-center gap-1.5 pr-3 border-r border-border shrink-0">
          <span className="font-heading font-bold text-lg tracking-tight text-primary">
            Campus<span className="text-medical">Care</span>
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="hidden sm:inline">CampusCare</span>
            <span className="hidden sm:inline text-ink-subtle">/</span>
            <span className="font-medium text-primary truncate">{title}</span>
          </div>
          <h1 className="font-heading font-bold text-lg sm:text-2xl text-ink leading-tight truncate">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Notification Center & User Profile Dropdown */}
      <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
        
        {/* Notification Center Popover */}
        <NotificationCenter 
          user={user} 
          onViewAllNotifications={onNotificationClick} 
        />

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* User Profile Menu Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            type="button"
            className="flex items-center gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-background transition-colors focus-ring text-left cursor-pointer border border-transparent hover:border-border"
            aria-expanded={profileOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
              {user.initials}
            </div>
            
            <div className="hidden sm:block text-left">
              <span className="text-xs font-bold text-ink block leading-tight truncate max-w-[130px]">
                {user.name}
              </span>
              <span className="text-[10px] text-ink-muted block font-medium truncate max-w-[130px]">
                {user.roleLabel}
              </span>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-200 hidden sm:block ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Polished Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-surface border border-border rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* Header */}
              <div className="p-4 bg-background border-b border-border space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-surface font-mono font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {user.initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-ink truncate">{user.name}</h4>
                      <div className="flex items-center gap-1 text-xs text-ink-muted truncate">
                        <Mail className="w-3 h-3 text-ink-subtle shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs border-t border-border/60">
                  <StatusBadge status={user.role === 'student_faculty' ? 'ACTIVE' : user.roleLabel} />
                  {user.universityId && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted">
                      <IdCard className="w-3 h-3 text-primary" />
                      ID: {user.universityId}
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation Options */}
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    if (onProfileClick) onProfileClick();
                  }}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-ink hover:bg-background transition-colors focus-ring"
                >
                  <User className="w-4 h-4 text-primary" />
                  <span>My Profile & Settings</span>
                </button>

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    if (onNotificationClick) onNotificationClick();
                  }}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-ink hover:bg-background transition-colors focus-ring"
                >
                  <Bell className="w-4 h-4 text-medical" />
                  <span>Announcements & Alerts</span>
                </button>
              </div>

              {/* Compliance Note & Logout */}
              <div className="p-3 bg-background border-t border-border space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <ShieldCheck className="w-3.5 h-3.5 text-wellness shrink-0" />
                  <span>Verified University Portal &bull; FERPA Compliant</span>
                </div>

                {onLogout && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-emergency hover:bg-emergency/10 rounded-xl transition-colors focus-ring cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out of Account</span>
                  </button>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

    </header>
  );
};



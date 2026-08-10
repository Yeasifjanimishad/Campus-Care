import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Bell, 
  FileText,
  Activity,
  Megaphone,
  User, 
  LogOut,
  ShieldCheck,
  Users,
  History,
  Server,
  HeartPulse
} from 'lucide-react';
import { AppNavId, UserProfile } from '../types';

interface SidebarProps {
  activeNav: AppNavId;
  onNavChange: (nav: AppNavId) => void;
  user: UserProfile;
  onLogout: () => void;
}

interface NavGroup {
  title: string;
  items: {
    id: AppNavId;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavChange,
  user,
  onLogout,
}) => {
  const getNavGroups = (): NavGroup[] => {
    const role = user.role;

    if (role === 'super_admin') {
      return [
        {
          title: 'GOVERNANCE',
          items: [
            { id: 'dashboard', label: 'System Dashboard', icon: LayoutDashboard },
            { id: 'alerts', label: 'Priority Matrix & SOS', icon: Bell },
            { id: 'reports', label: 'Incident Governance', icon: FileText },
          ]
        },
        {
          title: 'ADMINISTRATION',
          items: [
            { id: 'records', label: 'Health Records Trail', icon: Activity },
            { id: 'notifications', label: 'Broadcast Dispatch', icon: Megaphone },
            { id: 'profile', label: 'Admin Account', icon: User },
          ]
        }
      ];
    }

    if (role === 'emergency_admin') {
      return [
        {
          title: 'EMERGENCY & DISPATCH',
          items: [
            { id: 'dashboard', label: 'Dispatch Overview', icon: LayoutDashboard },
            { id: 'alerts', label: 'Live SOS Monitor', icon: Bell },
            { id: 'reports', label: 'Incident Management', icon: FileText },
          ]
        },
        {
          title: 'COMMUNICATIONS & LOGS',
          items: [
            { id: 'notifications', label: 'Campus Broadcasts', icon: Megaphone },
            { id: 'records', label: 'System Records', icon: Activity },
            { id: 'profile', label: 'Admin Profile', icon: User },
          ]
        }
      ];
    }

    if (role === 'doctor') {
      return [
        {
          title: 'CLINICAL CARE',
          items: [
            { id: 'dashboard', label: 'Doctor Console', icon: LayoutDashboard },
            { id: 'appointments', label: 'Appointment Schedule', icon: CalendarDays },
            { id: 'records', label: 'Patient Medical Records', icon: Activity },
          ]
        },
        {
          title: 'SAFETY & NOTICES',
          items: [
            { id: 'alerts', label: 'On-Call SOS Alerts', icon: Bell },
            { id: 'notifications', label: 'Medical Bulletins', icon: Megaphone },
            { id: 'reports', label: 'Clinical Incidents', icon: FileText },
            { id: 'profile', label: 'Doctor Profile', icon: User },
          ]
        }
      ];
    }

    // Default: Student & Faculty
    return [
      {
        title: 'STUDENT HEALTH',
        items: [
          { id: 'dashboard', label: 'Care Dashboard', icon: LayoutDashboard },
          { id: 'appointments', label: 'Medical Consultations', icon: CalendarDays },
          { id: 'records', label: 'Health Records', icon: Activity },
        ]
      },
      {
        title: 'SAFETY & SERVICES',
        items: [
          { id: 'alerts', label: 'Emergency SOS', icon: Bell },
          { id: 'notifications', label: 'Announcements', icon: Megaphone },
          { id: 'reports', label: 'Report Incident', icon: FileText },
          { id: 'profile', label: 'My Profile', icon: User },
        ]
      }
    ];
  };

  const navGroups = getNavGroups();

  return (
    <aside className="w-64 bg-surface border-r border-border h-screen flex flex-col justify-between fixed top-0 left-0 z-30 select-none shadow-2xs">
      
      {/* Top Section: Wordmark & Navigation */}
      <div className="flex flex-col flex-1 min-h-0">
        
        {/* Header / Brand */}
        <div className="h-16 sm:h-20 px-6 flex items-center justify-between border-b border-border shrink-0 bg-surface">
          <a 
            href="#landing" 
            onClick={(e) => { e.preventDefault(); onNavChange('dashboard'); }} 
            className="focus-ring rounded-lg flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5 text-medical" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight text-primary">
              Campus<span className="text-medical">Care</span>
            </span>
          </a>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
            PRO
          </span>
        </div>

        {/* Navigation Groups */}
        <nav className="p-3 space-y-5 overflow-y-auto flex-1" aria-label="App Navigation">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 text-[10px] font-bold text-ink-subtle uppercase tracking-wider">
                {group.title}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavChange(item.id)}
                    type="button"
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all relative focus-ring cursor-pointer ${
                      isActive
                        ? 'bg-primary text-surface shadow-sm font-bold'
                        : 'text-ink-muted hover:bg-background hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-surface' : 'text-ink-muted'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-surface shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Security / Verification Badge */}
        <div className="px-4 py-3 mx-3 my-2 rounded-xl bg-background border border-border text-xs text-ink-muted flex items-center gap-2.5 shrink-0">
          <ShieldCheck className="w-4 h-4 text-wellness shrink-0" />
          <div className="min-w-0">
            <span className="font-bold text-ink block truncate text-[11px]">Verified .edu Portal</span>
            <span className="text-[10px] text-ink-subtle block truncate">HIPAA & FERPA Compliant</span>
          </div>
        </div>

      </div>

      {/* Bottom Section: User Info Block & Log Out */}
      <div className="p-3 border-t border-border bg-surface shrink-0 space-y-2">
        
        {/* User Card */}
        <div className="flex items-center gap-3 p-2 rounded-xl bg-background border border-border">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink truncate leading-tight">
              {user.name}
            </p>
            <p className="text-[10px] text-ink-muted truncate">
              {user.roleLabel}
            </p>
          </div>
        </div>

        {/* Log Out Button */}
        <button
          onClick={onLogout}
          type="button"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-ink-muted hover:text-emergency hover:bg-emergency/10 rounded-xl transition-colors focus-ring cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>

      </div>

    </aside>
  );
};


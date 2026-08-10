import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  AlertTriangle, 
  Activity, 
  Calendar, 
  ShieldCheck, 
  Megaphone, 
  ChevronRight, 
  Clock, 
  X,
  Sparkles,
  Info
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { NotificationItem, UserProfile, BroadcastCategory, BroadcastPriority } from '../types';

interface NotificationCenterProps {
  user: UserProfile;
  onViewAllNotifications?: () => void;
}

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-001',
    user_id: 'usr-001',
    title: 'Seasonal Flu Vaccination Drive',
    message: 'Free flu vaccination doses are available at Campus Medical Center starting Sunday.',
    category: 'health',
    priority: 'high',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: 'notif-002',
    user_id: 'usr-001',
    title: 'Doctor Appointment Confirmed',
    message: 'Your appointment with Dr. Sarah Ahmed has been confirmed.',
    category: 'appointment',
    priority: 'normal',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  }
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  user, 
  onViewAllNotifications 
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      if (isSupabaseConfigured) {
        const authUser = (await supabase.auth.getUser()).data?.user;
        if (authUser) {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

          if (!error && data && data.length > 0) {
            setNotifications(data as NotificationItem[]);
            const count = (data as NotificationItem[]).filter(n => !n.is_read).length;
            setUnreadCount(count);
            return;
          }
        }
      }

      setNotifications(SAMPLE_NOTIFICATIONS);
      setUnreadCount(SAMPLE_NOTIFICATIONS.filter(n => !n.is_read).length);
    } catch (err) {
      console.warn('[NotificationCenter] Notice loading fallback notifications:', err);
      setNotifications(SAMPLE_NOTIFICATIONS);
      setUnreadCount(SAMPLE_NOTIFICATIONS.filter(n => !n.is_read).length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for incoming notifications
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let channel: any = null;
    let isMounted = true;

    const setupRealtime = async () => {
      const authUser = (await supabase.auth.getUser()).data.user;
      if (!authUser || !isMounted) return;

      const channelName = `user-notifications-${authUser.id}-${Math.random().toString(36).substring(2, 9)}`;
      const newChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${authUser.id}`,
          },
          (payload) => {
            if (!isMounted) return;
            if (payload.eventType === 'INSERT') {
              const newNotif = payload.new as NotificationItem;
              setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== newNotif.id)]);
              setUnreadCount(prev => prev + 1);
            } else if (payload.eventType === 'UPDATE') {
              const updatedNotif = payload.new as NotificationItem;
              setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n));
              // recalculate unread count
              setNotifications(prev => {
                const count = prev.filter(n => !n.is_read).length;
                setUnreadCount(count);
                return prev;
              });
            }
          }
        )
        .subscribe();

      if (isMounted) {
        channel = newChannel;
      } else {
        supabase.removeChannel(newChannel);
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));

      await supabase.rpc('mark_notification_read', { p_notification_id: id });
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);

      await supabase.rpc('mark_all_notifications_read');
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const getCategoryIcon = (category: BroadcastCategory) => {
    switch (category) {
      case 'emergency':
        return <AlertTriangle className="w-4 h-4 text-emergency" />;
      case 'health':
        return <Activity className="w-4 h-4 text-medical" />;
      case 'appointment':
        return <Calendar className="w-4 h-4 text-primary" />;
      case 'safety':
        return <ShieldCheck className="w-4 h-4 text-wellness" />;
      default:
        return <Megaphone className="w-4 h-4 text-primary" />;
    }
  };

  const getPriorityBadge = (priority: BroadcastPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emergency text-emergency-contrast animate-pulse uppercase tracking-wider">
            Urgent
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            High
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-hover text-ink-muted uppercase tracking-wider">
            Info
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary uppercase tracking-wider">
            Notice
          </span>
        );
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="relative p-2 text-ink-muted hover:text-ink hover:bg-background rounded-xl transition-colors focus-ring cursor-pointer"
        aria-label={`${unreadCount} unread notifications`}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-emergency text-emergency-contrast font-mono font-bold text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-2xs border border-surface animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface rounded-2xl border border-border shadow-xl z-50 overflow-hidden animate-fadeIn space-y-0">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-ink text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emergency/10 text-emergency text-2xs font-bold font-mono">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-2xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Read all</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-ink-muted space-y-2">
                <Bell className="w-8 h-8 mx-auto text-ink-muted/50" />
                <p className="text-xs">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleMarkAsRead(item.id)}
                  className={`p-4 transition-colors cursor-pointer flex items-start gap-3 relative group ${
                    !item.is_read 
                      ? 'bg-primary/5 hover:bg-primary/10' 
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  {/* Category Icon Badge */}
                  <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-ink truncate leading-tight">
                        {item.title}
                      </span>
                      {getPriorityBadge(item.priority)}
                    </div>

                    <p className="text-2xs text-ink-muted leading-relaxed line-clamp-2">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-ink-muted pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.created_at)}
                      </span>

                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary inline-block" title="Unread" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer View All */}
          <div className="p-3 bg-surface-hover/80 border-t border-border text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onViewAllNotifications) onViewAllNotifications();
              }}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All Campus Announcements</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

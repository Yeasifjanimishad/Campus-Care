import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  Search, 
  CheckCheck, 
  AlertTriangle, 
  Activity, 
  Calendar, 
  ShieldCheck, 
  Megaphone, 
  Clock, 
  Loader2, 
  AlertCircle, 
  Filter, 
  CheckCircle2, 
  Inbox
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { NotificationItem, UserProfile, BroadcastCategory, BroadcastPriority } from '../types';

interface StudentNotificationsViewProps {
  user: UserProfile;
}

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-001',
    user_id: 'usr-001',
    title: 'Seasonal Flu Vaccination Drive at Campus Medical Center',
    message: 'Free flu vaccination doses are available for all DIU students, faculty, and campus staff at the Main Medical Center building starting this Sunday from 9:00 AM.',
    category: 'health',
    priority: 'high',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: 'notif-002',
    user_id: 'usr-001',
    title: 'Doctor Appointment Confirmation',
    message: 'Your appointment with Dr. Sarah Ahmed (Cardiology) has been confirmed for tomorrow at 10:30 AM.',
    category: 'appointment',
    priority: 'normal',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  },
  {
    id: 'notif-003',
    user_id: 'usr-001',
    title: 'Emergency SOS Protocol Drills',
    message: 'Routine emergency response system testing and siren verification completed across campus buildings.',
    category: 'safety',
    priority: 'low',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
  }
];

export const StudentNotificationsView: React.FC<StudentNotificationsViewProps> = ({ user }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch('/notifications?limit=100');
      if (response && response.data) {
        setNotifications(response.data);
      } else {
        setNotifications(SAMPLE_NOTIFICATIONS);
      }
    } catch (err: any) {
      console.warn('Error in fetchNotifications, using sample dataset:', err);
      setNotifications(SAMPLE_NOTIFICATIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    let ws: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: any;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/realtime`;
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        if (!isMounted) return;
        const token = localStorage.getItem('campuscare_session_token');
        if (token) {
          ws?.send(JSON.stringify({ type: 'auth', token }));
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification_update') {
            fetchNotifications();
          }
        } catch (e) {
          console.error('WS Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      await apiFetch('/notifications/read-all', { method: 'POST' });
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  // Filtered list
  const filteredNotifications = notifications.filter(n => {
    // Status filter
    if (statusFilter === 'unread' && n.is_read) return false;
    if (statusFilter === 'read' && !n.is_read) return false;

    // Category filter
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;

    // Priority filter
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = n.title.toLowerCase().includes(q);
      const msgMatch = n.message.toLowerCase().includes(q);
      return titleMatch || msgMatch;
    }

    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getCategoryIcon = (category: BroadcastCategory) => {
    switch (category) {
      case 'emergency':
        return <AlertTriangle className="w-5 h-5 text-emergency" />;
      case 'health':
        return <Activity className="w-5 h-5 text-medical" />;
      case 'appointment':
        return <Calendar className="w-5 h-5 text-primary" />;
      case 'safety':
        return <ShieldCheck className="w-5 h-5 text-wellness" />;
      default:
        return <Megaphone className="w-5 h-5 text-primary" />;
    }
  };

  const getPriorityBadge = (priority: BroadcastPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emergency text-emergency-contrast uppercase tracking-wider animate-pulse">
            Urgent
          </span>
        );
      case 'high':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            High Priority
          </span>
        );
      case 'low':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-surface-hover text-ink-muted uppercase tracking-wider">
            Information
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-primary/10 text-primary uppercase tracking-wider">
            Notice
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-ink">Campus Announcements & Notifications</h2>
            </div>
            <p className="text-xs text-ink-muted">
              Important campus health advisories, safety alerts, medical appointment updates, and official notices.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-primary-contrast font-semibold text-xs transition-colors shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read ({unreadCount})</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filters Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search announcements by title or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="all">All Statuses ({notifications.length})</option>
            <option value="unread">Unread Only ({unreadCount})</option>
            <option value="read">Read Only ({notifications.length - unreadCount})</option>
          </select>

          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="health">Health & Medical</option>
            <option value="emergency">Emergency</option>
            <option value="appointment">Appointments</option>
            <option value="safety">Campus Safety</option>
            <option value="campus">Campus Operations</option>
          </select>
        </div>
      </div>

      {/* Notifications Log */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <Inbox className="w-4 h-4 text-primary" />
            Inbox ({filteredNotifications.length})
          </h3>
          <span className="text-2xs text-ink-muted font-mono">Realtime Security Channel</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-ink-muted space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs">Loading campus notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-12 text-center text-ink-muted space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-hover mx-auto flex items-center justify-center text-ink-muted">
              <Bell className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium">No matching notifications found.</p>
            <p className="text-2xs text-ink-muted max-w-sm mx-auto">
              You are up to date! Official campus alerts and broadcast announcements will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.is_read && handleMarkAsRead(item.id)}
                className={`p-5 rounded-2xl border transition-all space-y-2 shadow-2xs ${
                  !item.is_read
                    ? 'bg-primary/5 border-primary/30 hover:border-primary/60 cursor-pointer'
                    : 'bg-surface border-border hover:border-border/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      {getCategoryIcon(item.category)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-ink">{item.title}</span>
                        {getPriorityBadge(item.priority)}
                        {!item.is_read && (
                          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-contrast text-[10px] font-bold">
                            NEW
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">
                        {item.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    <span className="text-2xs text-ink-muted font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.created_at)}
                    </span>

                    {!item.is_read ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(item.id);
                        }}
                        className="text-2xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Mark Read
                      </button>
                    ) : (
                      <span className="text-2xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-3 h-3" /> Read
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

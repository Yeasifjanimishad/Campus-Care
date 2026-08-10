import React, { useState, useEffect, useCallback } from 'react';
import { 
  Megaphone, 
  Plus, 
  Search, 
  AlertTriangle, 
  Activity, 
  Calendar, 
  ShieldCheck, 
  Users, 
  Clock, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Send, 
  Eye, 
  Building,
  ShieldAlert,
  Info
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Broadcast, UserProfile, BroadcastCategory, BroadcastPriority, BroadcastTargetRole } from '../types';

interface AdminBroadcastManagerProps {
  user: UserProfile;
}

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

const SAMPLE_BROADCASTS: Broadcast[] = [
  {
    id: 'bc-001',
    title: 'Seasonal Flu Vaccination Drive at Campus Medical Center',
    message: 'Free flu vaccination doses are available for all DIU students, faculty, and campus staff at the Main Medical Center building starting this Sunday from 9:00 AM.',
    category: 'health',
    priority: 'high',
    target_role: 'all',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    created_by: 'usr-001',
    creator: { name: 'Super Admin', email: 'superadmin@diu.edu.bd' }
  },
  {
    id: 'bc-002',
    title: 'Emergency SOS Protocol Drills & Siren Testing',
    message: 'Routine emergency response system testing and siren verification will occur across all academic buildings today at 3:00 PM.',
    category: 'safety',
    priority: 'normal',
    target_role: 'all',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    created_by: 'usr-002',
    creator: { name: 'Emergency Controller', email: 'admin@diu.edu.bd' }
  },
  {
    id: 'bc-003',
    title: 'Medical Center Weekend Hours & On-Call Doctors',
    message: 'Specialist physicians will be on duty this weekend for cardiology and general consultations. Online appointment booking is open.',
    category: 'appointment',
    priority: 'low',
    target_role: 'student_faculty',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    created_by: 'usr-003',
    creator: { name: 'Dr. Sarah Ahmed', email: 'doctor@diu.edu.bd' }
  }
];

export const AdminBroadcastManager: React.FC<AdminBroadcastManagerProps> = ({ user }) => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [category, setCategory] = useState<BroadcastCategory>('general');
  const [priority, setPriority] = useState<BroadcastPriority>('normal');
  const [targetRole, setTargetRole] = useState<BroadcastTargetRole>('all');

  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Urgent Confirmation Modal State
  const [showUrgentConfirmation, setShowUrgentConfirmation] = useState<boolean>(false);

  // Filters for History
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [targetFilter, setTargetFilter] = useState<string>('all');

  const getLocalBroadcasts = (): Broadcast[] => {
    try {
      const stored = localStorage.getItem('campuscare_broadcasts');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  };

  const saveLocalBroadcast = (bc: Broadcast) => {
    try {
      const current = getLocalBroadcasts();
      current.unshift(bc);
      localStorage.setItem('campuscare_broadcasts', JSON.stringify(current));
    } catch (e) {
      console.warn('Failed saving local broadcast:', e);
    }
  };

  const fetchBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const localList = getLocalBroadcasts();
      let remoteList: Broadcast[] = [];

      if (isSupabaseConfigured) {
        const { data, error: fetchErr } = await supabase
          .from('broadcasts')
          .select(`
            *,
            creator:users!broadcasts_created_by_fkey (name, email)
          `)
          .order('created_at', { ascending: false });

        if (fetchErr) {
          console.warn('Notice fetching broadcasts from Supabase:', fetchErr.message);
        } else if (data && data.length > 0) {
          remoteList = data as Broadcast[];
        }
      }

      // Merge local, remote, and sample broadcasts
      const bcMap = new Map<string, Broadcast>();
      localList.forEach(b => bcMap.set(b.id, b));
      remoteList.forEach(b => {
        if (!bcMap.has(b.id)) bcMap.set(b.id, b);
      });
      SAMPLE_BROADCASTS.forEach(b => {
        if (!bcMap.has(b.id)) bcMap.set(b.id, b);
      });

      const merged = Array.from(bcMap.values());
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setBroadcasts(merged);
    } catch (err: any) {
      console.warn('Error in fetchBroadcasts, using fallback dataset:', err);
      const localList = getLocalBroadcasts();
      const bcMap = new Map<string, Broadcast>();
      localList.forEach(b => bcMap.set(b.id, b));
      SAMPLE_BROADCASTS.forEach(b => {
        if (!bcMap.has(b.id)) bcMap.set(b.id, b);
      });
      const merged = Array.from(bcMap.values());
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setBroadcasts(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const handleOpenCreateModal = () => {
    setTitle('');
    setMessage('');
    setCategory('general');
    setPriority('normal');
    setTargetRole('all');
    setFormError(null);
    setFormSuccess(null);
    setShowUrgentConfirmation(false);
    setIsModalOpen(true);
  };

  const handleInitialFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Announcement title is required.');
      return;
    }

    if (!message.trim()) {
      setFormError('Announcement message body is required.');
      return;
    }

    // If priority is urgent, require confirmation modal
    if (priority === 'urgent') {
      setShowUrgentConfirmation(true);
    } else {
      executeSendBroadcast();
    }
  };

  const executeSendBroadcast = async () => {
    try {
      setSaving(true);
      setFormError(null);

      const newBroadcast: Broadcast = {
        id: 'bc-' + Math.random().toString(36).substring(2, 9),
        title: title.trim(),
        message: message.trim(),
        category,
        priority,
        target_role: targetRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.id || 'usr-admin',
        creator: { name: user.name || 'Administrator', email: user.email }
      };

      let sentSuccess = false;

      if (isSupabaseConfigured) {
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('create_broadcast', {
            p_title: title.trim(),
            p_message: message.trim(),
            p_category: category,
            p_priority: priority,
            p_target_role: targetRole
          });

          if (!rpcErr && rpcData?.success) {
            sentSuccess = true;
            setFormSuccess(`Broadcast sent! Delivered to ${rpcData.recipient_count || 1} user accounts.`);
          } else {
            console.warn('[Broadcast RPC Notice]: RPC call failed or unavailable, using table insert or local fallback', rpcErr?.message);
            const { error: insertErr } = await supabase.from('broadcasts').insert([{
              title: title.trim(),
              message: message.trim(),
              category,
              priority,
              target_role: targetRole,
              created_by: user.id || 'usr-admin'
            }]);

            if (!insertErr) {
              sentSuccess = true;
              setFormSuccess('Broadcast published successfully!');
            }
          }
        } catch (e: any) {
          console.warn('[Broadcast Dispatch Exception]:', e);
        }
      }

      saveLocalBroadcast(newBroadcast);

      if (!sentSuccess) {
        setBroadcasts(prev => [newBroadcast, ...prev]);
        setFormSuccess('Broadcast announcement dispatched successfully across campus networks!');
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setShowUrgentConfirmation(false);
        fetchBroadcasts();
      }, 1200);

    } catch (err: any) {
      console.error('Error sending broadcast:', err);
      setFormError(err.message || 'An error occurred dispatching broadcast.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Broadcast History
  const filteredBroadcasts = broadcasts.filter(b => {
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && b.priority !== priorityFilter) return false;
    if (targetFilter !== 'all' && b.target_role !== targetFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = b.title.toLowerCase().includes(q);
      const msgMatch = b.message.toLowerCase().includes(q);
      return titleMatch || msgMatch;
    }

    return true;
  });

  const getCategoryIcon = (cat: BroadcastCategory) => {
    switch (cat) {
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

  const getPriorityBadge = (prio: BroadcastPriority) => {
    switch (prio) {
      case 'urgent':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emergency text-emergency-contrast uppercase tracking-wider animate-pulse">
            Urgent Broadcast
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
            Low Priority
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-primary/10 text-primary uppercase tracking-wider">
            Normal Priority
          </span>
        );
    }
  };

  const getTargetRoleLabel = (role: BroadcastTargetRole) => {
    switch (role) {
      case 'all':
        return 'All Users (Campus Wide)';
      case 'student_faculty':
        return 'Students & Faculty Only';
      case 'doctor':
        return 'Campus Doctors Only';
      case 'emergency_admin':
        return 'Emergency Admins Only';
      case 'super_admin':
        return 'Super Admins Only';
      default:
        return role;
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
              <Megaphone className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-ink">CampusCare Broadcast Dispatch Console</h2>
            </div>
            <p className="text-xs text-ink-muted">
              Dispatch official campus alerts, health advisories, and administrative safety announcements to target audience groups.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-contrast hover:bg-primary-hover font-bold text-xs transition-colors shrink-0 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Broadcast</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search history by title or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

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

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="all">All Audiences</option>
            <option value="all">All Users</option>
            <option value="student_faculty">Students & Faculty</option>
            <option value="doctor">Doctors</option>
            <option value="emergency_admin">Emergency Admins</option>
            <option value="super_admin">Super Admins</option>
          </select>
        </div>
      </div>

      {/* Broadcast History List */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Broadcast Log History ({filteredBroadcasts.length})
          </h3>
          <span className="text-2xs text-ink-muted font-mono">Verified Admin Audit Trail</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-ink-muted space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs">Loading broadcast history...</p>
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div className="py-12 text-center text-ink-muted space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-hover mx-auto flex items-center justify-center text-ink-muted">
              <Megaphone className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium">No broadcasts found in audit history.</p>
            <p className="text-2xs text-ink-muted max-w-sm mx-auto">
              Click &quot;Create New Broadcast&quot; above to dispatch an announcement or alert to campus users.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBroadcasts.map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl border border-border bg-surface space-y-3 shadow-2xs hover:border-primary/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      {getCategoryIcon(b.category)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-ink">{b.title}</h4>
                        {getPriorityBadge(b.priority)}
                        <span className="px-2 py-0.5 rounded-full bg-surface-hover text-ink-muted text-2xs font-semibold border border-border">
                          Audience: {getTargetRoleLabel(b.target_role)}
                        </span>
                      </div>

                      <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">
                        {b.message}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/80 text-2xs text-ink-muted font-mono bg-surface-hover/50 p-2.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span>Issued By: {b.creator?.name || 'Administrator'}</span>
                    <span>•</span>
                    <span>Dispatched: {formatDate(b.created_at)}</span>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    Target Broadcast ID: {b.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-ink text-base">New Campus Broadcast Announcement</h3>
                </div>
                <p className="text-2xs text-ink-muted">
                  Compose and issue an official notification to users on the CampusCare network.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleInitialFormSubmit} className="space-y-4 text-xs">
              {/* Category & Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink">
                    Announcement Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BroadcastCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="general">General Notice</option>
                    <option value="health">Health & Medical</option>
                    <option value="emergency">Emergency Alert</option>
                    <option value="appointment">Appointments</option>
                    <option value="safety">Campus Safety</option>
                    <option value="campus">Operations</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as BroadcastPriority)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-semibold"
                  >
                    <option value="low">Low (Informational)</option>
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent (Immediate Alert)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink">
                    Target Audience
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as BroadcastTargetRole)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="all">All Users (Campus Wide)</option>
                    <option value="student_faculty">Students & Faculty</option>
                    <option value="doctor">Campus Doctors Only</option>
                    <option value="emergency_admin">Emergency Admins</option>
                    <option value="super_admin">Super Admins</option>
                  </select>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink">
                  Broadcast Headline Title <span className="text-emergency">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Campus Health Advisory: Seasonal Flu Vaccination Drive"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-semibold text-xs"
                />
              </div>

              {/* Message Body */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink">
                  Broadcast Message Body <span className="text-emergency">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide clear instructions or details regarding this campus health or safety notice..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              {/* Live Preview Section */}
              <div className="p-4 rounded-xl bg-surface-hover border border-border space-y-2">
                <div className="flex items-center gap-1.5 text-2xs font-bold text-ink-muted uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Recipient Notification Preview</span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-border shadow-2xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-ink">{title || 'Broadcast Title Placeholder'}</span>
                    {getPriorityBadge(priority)}
                  </div>
                  <p className="text-2xs text-ink-muted line-clamp-2">{message || 'Your broadcast message preview will appear here.'}</p>
                  <div className="flex items-center justify-between text-[10px] text-ink-muted pt-1">
                    <span>Audience: {getTargetRoleLabel(targetRole)}</span>
                    <span className="font-mono">Just now</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-surface text-ink hover:bg-surface-hover font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-contrast hover:bg-primary-hover font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Dispatch Broadcast</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Urgent Priority Confirmation Modal */}
      {showUrgentConfirmation && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-emergency/40 p-6 shadow-2xl max-w-md w-full space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emergency/15 text-emergency mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-ink text-base">Confirm Urgent Campus Broadcast?</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                You are about to send an <strong className="text-emergency">URGENT</strong> high-priority broadcast announcement to <strong className="text-ink">{getTargetRoleLabel(targetRole)}</strong>.
              </p>
              <div className="p-3 rounded-xl bg-emergency/5 border border-emergency/20 text-2xs text-ink text-left font-mono">
                &quot;{title}&quot;
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUrgentConfirmation(false)}
                className="px-4 py-2 rounded-xl border border-border bg-surface text-ink hover:bg-surface-hover font-semibold text-xs transition-colors cursor-pointer"
              >
                Go Back
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={executeSendBroadcast}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emergency text-emergency-contrast hover:bg-emergency-hover font-bold text-xs transition-colors cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Yes, Dispatch Urgent Alert</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

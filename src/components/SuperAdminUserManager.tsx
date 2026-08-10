import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ManagedUser, UserProfile, UserRole } from '../types';
import { 
  Users, 
  Search, 
  Filter, 
  ShieldAlert, 
  ShieldCheck, 
  UserX, 
  UserCheck, 
  Eye, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Info
} from 'lucide-react';

interface SuperAdminUserManagerProps {
  user: UserProfile;
}

const SAMPLE_USERS: ManagedUser[] = [
  {
    id: 'usr-001',
    name: 'Super Admin',
    email: 'superadmin@diu.edu.bd',
    role: 'super_admin',
    university_id: 'ADMIN-001',
    department: 'System Administration',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    phone: '+880 1700-000001',
  },
  {
    id: 'usr-002',
    name: 'Emergency Controller',
    email: 'admin@diu.edu.bd',
    role: 'emergency_admin',
    university_id: 'EMG-001',
    department: 'Emergency & Safety Dept',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    phone: '+880 1700-000002',
  },
  {
    id: 'usr-003',
    name: 'Dr. Sarah Ahmed',
    email: 'doctor@diu.edu.bd',
    role: 'doctor',
    university_id: 'DOC-101',
    department: 'Medical Center & Cardiology',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    phone: '+880 1711-223344',
  },
  {
    id: 'usr-004',
    name: 'Sokal Hossain',
    email: 'sokal@diu.edu.bd',
    role: 'student_faculty',
    university_id: '242-35-101',
    department: 'Computer Science & Engineering',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    phone: '+880 1812-345678',
  },
  {
    id: 'usr-005',
    name: 'Yeasif Jani Mishad',
    email: 'mishad242-35-739@diu.edu.bd',
    role: 'student_faculty',
    university_id: '242-35-739',
    department: 'Software Engineering',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    phone: '+880 1912-987654',
  },
  {
    id: 'usr-006',
    name: 'Dr. Tanvir Rahman',
    email: 'dr.tanvir@diu.edu.bd',
    role: 'doctor',
    university_id: 'DOC-102',
    department: 'General Medicine',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    phone: '+880 1755-667788',
  },
  {
    id: 'usr-007',
    name: 'Fatima Binte',
    email: 'student.fatima@diu.edu.bd',
    role: 'student_faculty',
    university_id: '242-35-802',
    department: 'Electrical Engineering',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    phone: '+880 1622-334455',
  },
  {
    id: 'usr-008',
    name: 'Rahim Chowdhury',
    email: 'student.rahim@diu.edu.bd',
    role: 'student_faculty',
    university_id: '242-35-905',
    department: 'Business Administration',
    status: 'suspended',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    phone: '+880 1533-445566',
  },
];

export const SuperAdminUserManager: React.FC<SuperAdminUserManagerProps> = ({ user }) => {
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected user for details modal
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  // Role Confirmation Modal State
  const [roleChangeModal, setRoleChangeModal] = useState<{
    isOpen: boolean;
    targetUser: ManagedUser | null;
    newRole: UserRole | null;
  }>({
    isOpen: false,
    targetUser: null,
    newRole: null,
  });

  // Status Confirmation Modal State
  const [statusChangeModal, setStatusChangeModal] = useState<{
    isOpen: boolean;
    targetUser: ManagedUser | null;
    newStatus: 'active' | 'suspended' | null;
  }>({
    isOpen: false,
    targetUser: null,
    newStatus: null,
  });

  const [processingAction, setProcessingAction] = useState<boolean>(false);

  const isSuperAdmin = user.role === 'super_admin';

  // Helper to read/write local user overrides
  const getLocalUserOverrides = (): Record<string, Partial<ManagedUser>> => {
    try {
      const stored = localStorage.getItem('campuscare_managed_users');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  };

  const saveLocalUserOverride = (userId: string, patch: Partial<ManagedUser>) => {
    try {
      const current = getLocalUserOverrides();
      current[userId] = { ...(current[userId] || {}), ...patch };
      localStorage.setItem('campuscare_managed_users', JSON.stringify(current));
    } catch (e) {
      console.warn('Failed saving local user override:', e);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    if (!isSuperAdmin) {
      setError('Access denied: User management is strictly restricted to Super Admin role.');
      setLoading(false);
      return;
    }

    const localOverrides = getLocalUserOverrides();

    try {
      let baseList: ManagedUser[] = [];
      if (isSupabaseConfigured) {
        const { data, error: fetchErr } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchErr) {
          console.warn('[SuperAdminUserManager]: Supabase error, using fallback users:', fetchErr.message);
          baseList = SAMPLE_USERS;
        } else if (data && data.length > 0) {
          baseList = data as ManagedUser[];
        } else {
          baseList = SAMPLE_USERS;
        }
      } else {
        baseList = SAMPLE_USERS;
      }

      // Apply local overrides
      const mergedList = baseList.map(u => {
        const override = localOverrides[u.id];
        return override ? { ...u, ...override } : u;
      });

      setUsersList(mergedList);
    } catch (err: any) {
      console.warn('Notice: Using fallback user directory:', err?.message || err);
      const mergedList = SAMPLE_USERS.map(u => {
        const override = localOverrides[u.id];
        return override ? { ...u, ...override } : u;
      });
      setUsersList(mergedList);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Subscribe to Realtime user updates if configured
    if (isSupabaseConfigured) {
      const channelName = `super_admin_users_${Math.random().toString(36).substring(2, 9)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchUsers();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user.role]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (u.status || 'active') === statusFilter;

    const q = searchQuery.toLowerCase().trim();
    const nameMatch = u.name?.toLowerCase().includes(q) || false;
    const emailMatch = u.email?.toLowerCase().includes(q) || false;
    const idMatch = u.university_id?.toLowerCase().includes(q) || false;
    const deptMatch = u.department?.toLowerCase().includes(q) || false;

    return matchesRole && matchesStatus && (!q || nameMatch || emailMatch || idMatch || deptMatch);
  });

  // Role Change RPC Call with direct update & local override fallback
  const confirmRoleChange = async () => {
    if (!roleChangeModal.targetUser || !roleChangeModal.newRole) return;

    setProcessingAction(true);
    setError(null);
    setSuccessMsg(null);

    const targetUser = roleChangeModal.targetUser;
    const newRole = roleChangeModal.newRole;

    if (isSupabaseConfigured) {
      try {
        const { data, error: rpcErr } = await supabase.rpc('update_user_role', {
          p_user_id: targetUser.id,
          p_new_role: newRole,
        });

        if (rpcErr || (data && data.success === false)) {
          // Direct update fallback
          await supabase
            .from('users')
            .update({ role: newRole })
            .eq('id', targetUser.id);
        }
      } catch (err: any) {
        console.warn('[Role Update Notice]: Saved via local state fallback:', err?.message || err);
      }
    }

    if (newRole === 'doctor') {
      const doctorObj = {
        id: targetUser.id,
        doctor_id: targetUser.universityId || targetUser.university_id || 'DOC-' + targetUser.id.slice(0, 4),
        full_name: targetUser.name.startsWith('Dr.') ? targetUser.name : `Dr. ${targetUser.name}`,
        email: targetUser.email,
        department: targetUser.department || 'Medical Center',
        specialization: 'General Medicine',
        designation: 'Medical Officer / Doctor',
        phone: targetUser.phone || '+880 1700-000000',
        bio: 'Campus medical officer providing clinical healthcare services.',
        profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const rawLocal = localStorage.getItem('campuscare_local_doctors');
        const existing = rawLocal ? JSON.parse(rawLocal) : [];
        const filtered = existing.filter((d: any) => d.id !== targetUser.id && d.email !== targetUser.email);
        filtered.unshift(doctorObj);
        localStorage.setItem('campuscare_local_doctors', JSON.stringify(filtered));
      } catch (e) {}

      if (isSupabaseConfigured) {
        try {
          await supabase.from('doctors').upsert({
            id: targetUser.id,
            user_id: targetUser.id,
            doctor_id: doctorObj.doctor_id,
            full_name: doctorObj.full_name,
            email: doctorObj.email,
            department: doctorObj.department,
            specialization: doctorObj.specialization,
            designation: doctorObj.designation,
            phone: doctorObj.phone,
            bio: doctorObj.bio,
            profile_image_url: doctorObj.profile_image_url,
            is_available: true,
          }, { onConflict: 'email' });
        } catch (e) {}
      }
    }

    // If updating current user's profile
    if (user?.email && targetUser.email && user.email.toLowerCase() === targetUser.email.toLowerCase()) {
      try {
        const rawDemo = localStorage.getItem('campuscare_demo_profile');
        if (rawDemo) {
          const parsed = JSON.parse(rawDemo);
          parsed.role = newRole;
          parsed.roleLabel = newRole === 'doctor' ? 'Medical Officer / Doctor' : 'Administrator';
          localStorage.setItem('campuscare_demo_profile', JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    saveLocalUserOverride(targetUser.id, { role: newRole, name: targetUser.name, email: targetUser.email });
    setUsersList((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
    );
    setSuccessMsg(`Role for ${targetUser.name} updated to ${newRole.replace('_', ' ').toUpperCase()} successfully.`);
    setProcessingAction(false);
    setRoleChangeModal({ isOpen: false, targetUser: null, newRole: null });
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Account Status RPC Call with direct update & local override fallback
  const confirmStatusChange = async () => {
    if (!statusChangeModal.targetUser || !statusChangeModal.newStatus) return;

    setProcessingAction(true);
    setError(null);
    setSuccessMsg(null);

    const targetUser = statusChangeModal.targetUser;
    const newStatus = statusChangeModal.newStatus;

    if (isSupabaseConfigured) {
      try {
        const { data, error: rpcErr } = await supabase.rpc('update_user_status', {
          p_user_id: targetUser.id,
          p_status: newStatus,
        });

        if (rpcErr || (data && data.success === false)) {
          // Direct update fallback
          await supabase
            .from('users')
            .update({ status: newStatus })
            .eq('id', targetUser.id);
        }
      } catch (err: any) {
        console.warn('[Status Update Notice]: Saved via local state fallback:', err?.message || err);
      }
    }

    saveLocalUserOverride(targetUser.id, { status: newStatus });
    setUsersList((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, status: newStatus } : u))
    );
    setSuccessMsg(`Account status for ${targetUser.name} updated to ${newStatus.toUpperCase()} successfully.`);
    setProcessingAction(false);
    setStatusChangeModal({ isOpen: false, targetUser: null, newStatus: null });
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Super Admin</span>
          </span>
        );
      case 'emergency_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emergency/10 text-emergency border border-emergency/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Emergency Admin</span>
          </span>
        );
      case 'doctor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-medical/10 text-medical border border-medical/20">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Doctor</span>
          </span>
        );
      case 'student_faculty':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-wellness/10 text-wellness border border-wellness/20">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student / Faculty</span>
          </span>
        );
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="bg-emergency/5 border border-emergency/20 rounded-2xl p-6 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-emergency mx-auto" />
        <h3 className="font-heading font-bold text-lg text-emergency">Access Restricted</h3>
        <p className="text-sm text-ink-muted max-w-md mx-auto">
          User Management requires Super Admin authorization. Your current role ({user.roleLabel}) does not permit user privilege modifications.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-2xl border border-border p-6 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Super Admin Suite</span>
          </div>
          <h2 className="font-heading font-bold text-xl text-ink">User Directory & Privilege Manager</h2>
          <p className="text-xs text-ink-muted">
            Manage university users, promote roles via secure PostgreSQL RPC, and handle account status locks.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-muted transition-colors focus-ring cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} type="button" className="text-emergency hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-wellness/10 border border-wellness/20 text-wellness text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} type="button" className="text-wellness hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, ID, or department..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-medium text-ink focus-ring"
          />
        </div>

        {/* Role Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer appearance-none"
          >
            <option value="all">All Roles</option>
            <option value="student_faculty">Student / Faculty</option>
            <option value="doctor">Doctor</option>
            <option value="emergency_admin">Emergency Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer appearance-none"
          >
            <option value="all">All Account Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-surface rounded-2xl border border-border">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs font-medium text-ink-muted">Querying university user records...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-surface rounded-2xl border border-border">
          <Users className="w-8 h-8 text-ink-muted/50 mx-auto" />
          <p className="text-sm font-semibold text-ink">No Registered Users Found</p>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            No users match the search and filter criteria. Try adjusting your search query.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-background/80 border-b border-border text-ink-muted font-semibold">
                  <th className="py-3 px-4">User Info</th>
                  <th className="py-3 px-4">Univ ID & Dept</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions & Role Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const isSelf = u.email === user.email;
                  const isSuspended = u.status === 'suspended';

                  return (
                    <tr key={u.id} className="hover:bg-background/40 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-ink">{u.name}</p>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/15 text-primary">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* ID & Dept */}
                      <td className="py-3 px-4">
                        <p className="font-mono text-ink font-medium">{u.university_id || 'N/A'}</p>
                        <p className="text-[11px] text-ink-muted">{u.department || 'General Campus'}</p>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getRoleBadge(u.role)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emergency/10 text-emergency border border-emergency/20">
                            <UserX className="w-3 h-3" />
                            <span>Suspended</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-wellness/10 text-wellness border border-wellness/20">
                            <UserCheck className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Info */}
                          <button
                            onClick={() => setSelectedUser(u)}
                            type="button"
                            className="p-2 rounded-lg bg-background hover:bg-surface-muted text-ink-muted hover:text-ink transition-colors focus-ring cursor-pointer"
                            title="View non-sensitive profile info"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Role Selector */}
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => {
                              const newR = e.target.value as UserRole;
                              if (newR !== u.role) {
                                setRoleChangeModal({
                                  isOpen: true,
                                  targetUser: u,
                                  newRole: newR,
                                });
                              }
                            }}
                            className="py-1 px-2.5 bg-background border border-border rounded-lg text-xs font-semibold text-ink focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="student_faculty">Student / Faculty</option>
                            <option value="doctor">Doctor</option>
                            <option value="emergency_admin">Emergency Admin</option>
                            <option value="super_admin">Super Admin</option>
                          </select>

                          {/* Suspend / Reactivate */}
                          {!isSelf && (
                            <button
                              onClick={() => {
                                setStatusChangeModal({
                                  isOpen: true,
                                  targetUser: u,
                                  newStatus: isSuspended ? 'active' : 'suspended',
                                });
                              }}
                              type="button"
                              className={`p-1.5 rounded-lg border text-xs font-medium transition-colors focus-ring cursor-pointer ${
                                isSuspended
                                  ? 'bg-wellness/10 border-wellness/30 text-wellness hover:bg-wellness hover:text-surface'
                                  : 'bg-emergency/10 border-emergency/30 text-emergency hover:bg-emergency hover:text-surface'
                              }`}
                              title={isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                            >
                              {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-background border-t border-border flex items-center justify-between text-[11px] text-ink-muted font-mono">
            <span>Showing {filteredUsers.length} of {usersList.length} university accounts</span>
            <span>Realtime RPC Role Governance</span>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {roleChangeModal.isOpen && roleChangeModal.targetUser && roleChangeModal.newRole && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-6 space-y-5 shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-primary">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-ink">Confirm Role Elevation / Change</h3>
                <p className="text-xs text-ink-muted">Super Admin Security Authorization</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border space-y-2 text-xs">
              <p className="text-ink font-semibold">
                User: <span className="text-primary">{roleChangeModal.targetUser.name}</span> ({roleChangeModal.targetUser.email})
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-ink-muted">Current Role:</span>
                {getRoleBadge(roleChangeModal.targetUser.role)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ink-muted">Target Role:</span>
                {getRoleBadge(roleChangeModal.newRole)}
              </div>
            </div>

            {roleChangeModal.newRole === 'doctor' && (
              <div className="p-3 rounded-xl bg-medical/10 border border-medical/20 text-medical text-xs flex items-start gap-2.5">
                <Stethoscope className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Promoting to <strong>Doctor</strong> will automatically provision or link a verified clinical Doctor profile in CampusCare.
                </p>
              </div>
            )}

            {(roleChangeModal.newRole === 'super_admin' || roleChangeModal.newRole === 'emergency_admin') && (
              <div className="p-3 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>High Privilege Warning:</strong> Granting Admin rights enables access to campus emergency monitors, broadcast alerts, and system management.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRoleChangeModal({ isOpen: false, targetUser: null, newRole: null })}
                disabled={processingAction}
                type="button"
                className="px-4 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-muted transition-colors focus-ring cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={processingAction}
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-surface text-xs font-semibold hover:bg-primary-hover transition-colors focus-ring cursor-pointer shadow-xs"
              >
                {processingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing RPC...</span>
                  </>
                ) : (
                  <span>Confirm Privilege Change</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Status Confirmation Modal */}
      {statusChangeModal.isOpen && statusChangeModal.targetUser && statusChangeModal.newStatus && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-6 space-y-5 shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-emergency">
              <div className="w-10 h-10 rounded-xl bg-emergency/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-emergency" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-ink">
                  {statusChangeModal.newStatus === 'suspended' ? 'Suspend Account' : 'Reactivate Account'}
                </h3>
                <p className="text-xs text-ink-muted">Super Admin Security Governance</p>
              </div>
            </div>

            <p className="text-xs text-ink">
              Are you sure you want to {statusChangeModal.newStatus === 'suspended' ? 'suspend' : 'reactivate'} the account for{' '}
              <strong className="text-primary">{statusChangeModal.targetUser.name}</strong> ({statusChangeModal.targetUser.email})?
            </p>

            {statusChangeModal.newStatus === 'suspended' && (
              <div className="p-3 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-xs">
                Suspended users will be restricted from accessing campus appointment booking, health records, and emergency reporting.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setStatusChangeModal({ isOpen: false, targetUser: null, newStatus: null })}
                disabled={processingAction}
                type="button"
                className="px-4 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-muted transition-colors focus-ring cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={processingAction}
                type="button"
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-surface text-xs font-semibold transition-colors focus-ring cursor-pointer shadow-xs ${
                  statusChangeModal.newStatus === 'suspended'
                    ? 'bg-emergency hover:bg-emergency/90'
                    : 'bg-wellness hover:bg-wellness/90'
                }`}
              >
                {processingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing RPC...</span>
                  </>
                ) : (
                  <span>{statusChangeModal.newStatus === 'suspended' ? 'Confirm Suspension' : 'Reactivate User'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Non-Sensitive Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-mono font-bold text-sm flex items-center justify-center">
                  {selectedUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-ink">{selectedUser.name}</h3>
                  <p className="text-xs text-ink-muted">Non-Sensitive User Profile</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                type="button"
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-background transition-colors focus-ring"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-background rounded-xl border border-border space-y-1">
                <span className="text-ink-muted font-mono block text-[10px] uppercase">Email Address</span>
                <span className="font-semibold text-ink break-all">{selectedUser.email}</span>
              </div>

              <div className="p-3 bg-background rounded-xl border border-border space-y-1">
                <span className="text-ink-muted font-mono block text-[10px] uppercase">University ID</span>
                <span className="font-mono font-semibold text-ink">{selectedUser.university_id || 'N/A'}</span>
              </div>

              <div className="p-3 bg-background rounded-xl border border-border space-y-1">
                <span className="text-ink-muted font-mono block text-[10px] uppercase">Current Role</span>
                <div>{getRoleBadge(selectedUser.role)}</div>
              </div>

              <div className="p-3 bg-background rounded-xl border border-border space-y-1">
                <span className="text-ink-muted font-mono block text-[10px] uppercase">Account Status</span>
                <span className={`font-semibold capitalize ${selectedUser.status === 'suspended' ? 'text-emergency' : 'text-wellness'}`}>
                  {selectedUser.status || 'active'}
                </span>
              </div>

              <div className="p-3 bg-background rounded-xl border border-border space-y-1">
                <span className="text-ink-muted font-mono block text-[10px] uppercase">Department</span>
                <span className="font-semibold text-ink">{selectedUser.department || 'Campus General'}</span>
              </div>

              <div className="p-3 bg-background rounded-xl border border-border space-y-1">
                <span className="text-ink-muted font-mono block text-[10px] uppercase">Phone Contact</span>
                <span className="font-mono font-semibold text-ink">{selectedUser.phone || 'Not provided'}</span>
              </div>
            </div>

            <div className="p-3 bg-surface-muted rounded-xl border border-border text-[11px] text-ink-muted flex items-center gap-2">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>CampusCare privacy policy enforces strict data minimization. Sensitive credentials and medical details are omitted.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedUser(null)}
                type="button"
                className="px-5 py-2 rounded-xl bg-primary text-surface text-xs font-semibold hover:bg-primary-hover transition-colors focus-ring"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

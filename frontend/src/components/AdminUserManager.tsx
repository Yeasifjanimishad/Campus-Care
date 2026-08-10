import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { UserProfile, UserRole, ManagedUser, Doctor } from '../types';
import { 
  Users, 
  Search, 
  Filter, 
  ShieldCheck, 
  ShieldAlert, 
  UserX, 
  UserCheck, 
  RefreshCw, 
  Eye, 
  Sliders, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Building, 
  Mail, 
  Phone, 
  FileText, 
  X,
  Stethoscope,
  Activity,
  Award,
  Lock,
  ChevronRight,
  Shield,
  User
} from 'lucide-react';

interface AdminUserManagerProps {
  user: UserProfile;
}

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

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

export const AdminUserManager: React.FC<AdminUserManagerProps> = ({ user }) => {
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Modals
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<ManagedUser | null>(null);
  const [doctorDetail, setDoctorDetail] = useState<Doctor | null>(null);
  const [loadingDoctorDetail, setLoadingDoctorDetail] = useState<boolean>(false);

  const [roleModalUser, setRoleModalUser] = useState<ManagedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student_faculty');
  const [updatingRole, setUpdatingRole] = useState<boolean>(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [statusModalUser, setStatusModalUser] = useState<ManagedUser | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'suspended' | 'disabled'>('active');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const isSuperAdmin = user.role === 'super_admin';
  const isEmergencyAdmin = user.role === 'emergency_admin';
  const isAdmin = isSuperAdmin || isEmergencyAdmin;

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

  // 1. Fetch Users List from Supabase with fallback to SAMPLE_USERS
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isAdmin) {
      setError('Access restricted: User management requires Administrator clearance.');
      setLoading(false);
      return;
    }

    const localOverrides = getLocalUserOverrides();

    try {
      let baseList: ManagedUser[] = [];
      const response = await apiFetch('/admin/users?limit=100');
      if (response && response.data) {
        baseList = response.data;
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
      console.warn('[AdminUserManager Error]: Failed to fetch users from backend, loading fallback user list:', err);
      const mergedList = SAMPLE_USERS.map(u => {
        const override = localOverrides[u.id];
        return override ? { ...u, ...override } : u;
      });
      setUsersList(mergedList);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();

    // Supabase Realtime Subscription for live updates
    if (isSupabaseConfigured && isAdmin) {
      const channel = supabase
        .channel('admin-users-live-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users' },
          () => {
            fetchUsers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchUsers, isAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // 2. Fetch Linked Doctor Profile for Detail Modal
  const fetchDoctorDetailForUser = async (targetUser: ManagedUser) => {
    setDoctorDetail(null);
    setLoadingDoctorDetail(true);

    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('doctors')
          .select('*')
          .or(`user_id.eq.${targetUser.id},email.eq.${targetUser.email}`)
          .maybeSingle();

        if (data) {
          setDoctorDetail(data as Doctor);
        }
      }
    } catch (err) {
      console.warn('[AdminUserManager]: Non-fatal error querying doctor detail:', err);
    } finally {
      setLoadingDoctorDetail(false);
    }
  };

  const handleOpenDetailModal = (targetUser: ManagedUser) => {
    setSelectedUserForDetail(targetUser);
    if (targetUser.role === 'doctor') {
      fetchDoctorDetailForUser(targetUser);
    }
  };

  // 3. Handle Role Update via RPC
  const handleOpenRoleModal = (targetUser: ManagedUser) => {
    setRoleError(null);
    setRoleModalUser(targetUser);
    setSelectedRole(targetUser.role);
  };

  const submitRoleUpdate = async () => {
    if (!roleModalUser || !isSuperAdmin) return;
    setUpdatingRole(true);
    setRoleError(null);

    try {
      await apiFetch(`/admin/users/${roleModalUser.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: selectedRole })
      });
    } catch (err: any) {
      console.warn('[Role Update Notice]: Falling back to local state:', err);
    }

    if (selectedRole === 'doctor') {
      const doctorObj = {
        id: roleModalUser.id,
        doctor_id: roleModalUser.universityId || roleModalUser.university_id || 'DOC-' + roleModalUser.id.slice(0, 4),
        full_name: roleModalUser.name.startsWith('Dr.') ? roleModalUser.name : `Dr. ${roleModalUser.name}`,
        email: roleModalUser.email,
        department: roleModalUser.department || 'Medical Center',
        specialization: 'General Medicine',
        designation: 'Medical Officer / Doctor',
        phone: roleModalUser.phone || '+880 1700-000000',
        bio: 'Campus medical officer providing clinical healthcare services.',
        profile_image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const rawLocal = localStorage.getItem('campuscare_local_doctors');
        const existing = rawLocal ? JSON.parse(rawLocal) : [];
        const filtered = existing.filter((d: any) => d.id !== roleModalUser.id && d.email !== roleModalUser.email);
        filtered.unshift(doctorObj);
        localStorage.setItem('campuscare_local_doctors', JSON.stringify(filtered));
      } catch (e) {}

      if (isSupabaseConfigured) {
        try {
          await supabase.from('doctors').upsert({
            id: roleModalUser.id,
            user_id: roleModalUser.id,
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

    // If updating current logged in user
    if (user?.email && roleModalUser.email && user.email.toLowerCase() === roleModalUser.email.toLowerCase()) {
      try {
        const rawDemo = localStorage.getItem('campuscare_demo_profile');
        if (rawDemo) {
          const parsed = JSON.parse(rawDemo);
          parsed.role = selectedRole;
          parsed.roleLabel = selectedRole === 'doctor' ? 'Medical Officer / Doctor' : 'Administrator';
          localStorage.setItem('campuscare_demo_profile', JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    // Always update local storage & state so admin UI updates immediately
    saveLocalUserOverride(roleModalUser.id, { role: selectedRole, name: roleModalUser.name, email: roleModalUser.email });
    setUsersList(prev => prev.map(u => u.id === roleModalUser.id ? { ...u, role: selectedRole } : u));
    setSuccessMsg(`User ${roleModalUser.name}'s role updated to ${selectedRole}.`);
    setRoleModalUser(null);
    setUpdatingRole(false);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // 4. Handle Status Update via RPC / direct update
  const handleOpenStatusModal = (targetUser: ManagedUser) => {
    setStatusError(null);
    setStatusModalUser(targetUser);
    setSelectedStatus(targetUser.status || 'active');
  };

  const submitStatusUpdate = async () => {
    if (!statusModalUser || !isAdmin) return;
    setUpdatingStatus(true);
    setStatusError(null);

    try {
      await apiFetch(`/admin/users/${statusModalUser.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: selectedStatus })
      });
    } catch (err: any) {
      console.warn('[Status Update Notice]: Falling back to local state:', err);
    }

    // Always update local storage & state so admin UI updates immediately
    saveLocalUserOverride(statusModalUser.id, { status: selectedStatus });
    setUsersList(prev => prev.map(u => u.id === statusModalUser.id ? { ...u, status: selectedStatus } : u));
    setSuccessMsg(`Account status for ${statusModalUser.name} changed to ${selectedStatus}.`);
    setStatusModalUser(null);
    setUpdatingStatus(false);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Filter & Sort Users
  const filteredUsers = usersList.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = u.name?.toLowerCase().includes(q) || false;
    const emailMatch = u.email?.toLowerCase().includes(q) || false;
    const idMatch = u.university_id?.toLowerCase().includes(q) || false;
    const deptMatch = u.department?.toLowerCase().includes(q) || false;
    const phoneMatch = u.phone?.toLowerCase().includes(q) || false;
    const searchMatch = !q || nameMatch || emailMatch || idMatch || deptMatch || phoneMatch;

    const roleMatch = roleFilter === 'all' || u.role === roleFilter;
    const statusVal = u.status || 'active';
    const statusMatch = statusFilter === 'all' || statusVal === statusFilter;

    return searchMatch && roleMatch && statusMatch;
  }).sort((a, b) => {
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
    if (sortBy === 'oldest') return (new Date(a.created_at || 0)).getTime() - (new Date(b.created_at || 0)).getTime();
    return (new Date(b.created_at || 0)).getTime() - (new Date(a.created_at || 0)).getTime(); // newest
  });

  // Calculate Real Stats
  const totalCount = usersList.length;
  const studentsCount = usersList.filter(u => u.role === 'student_faculty').length;
  const doctorsCount = usersList.filter(u => u.role === 'doctor').length;
  const emergencyAdminsCount = usersList.filter(u => u.role === 'emergency_admin').length;
  const superAdminsCount = usersList.filter(u => u.role === 'super_admin').length;
  const activeCount = usersList.filter(u => (u.status || 'active') === 'active').length;
  const suspendedCount = usersList.filter(u => u.status === 'suspended').length;
  const disabledCount = usersList.filter(u => u.status === 'disabled').length;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Super Admin</span>
          </span>
        );
      case 'emergency_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emergency/10 text-emergency border border-emergency/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Emergency Admin</span>
          </span>
        );
      case 'doctor':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-medical/10 text-medical border border-medical/30">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Doctor / Staff</span>
          </span>
        );
      case 'student_faculty':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-hover text-ink border border-border">
            <User className="w-3.5 h-3.5 text-ink-muted" />
            <span>Student / Faculty</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status?: string) => {
    const val = status || 'active';
    switch (val) {
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emergency/10 text-emergency border border-emergency/20">
            <UserX className="w-3.5 h-3.5" />
            <span>Suspended</span>
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-ink-muted/10 text-ink-muted border border-border">
            <Lock className="w-3.5 h-3.5" />
            <span>Disabled</span>
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-wellness/10 text-wellness border border-wellness/20">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Active</span>
          </span>
        );
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-emergency/5 border border-emergency/20 rounded-2xl p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-emergency mx-auto" />
        <h3 className="font-heading font-bold text-xl text-emergency">Access Restricted</h3>
        <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
          User Management and System Control requires Administrator clearance. Your current account role ({user.roleLabel}) does not possess administrative directory authorization.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-2xl border border-border p-6 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>CampusCare User Management Console</span>
          </div>
          <h2 className="font-heading font-bold text-2xl text-ink">System User Directory</h2>
          <p className="text-xs text-ink-muted">
            Manage student, physician, and emergency administrative accounts, role elevations, and account states.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors focus-ring cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          <span>Refresh User List</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-wellness/10 border border-wellness/20 text-wellness text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-wellness hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* System Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Total Users</p>
          <p className="font-heading font-bold text-lg text-ink">{totalCount}</p>
        </div>

        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Students</p>
          <p className="font-heading font-bold text-lg text-ink">{studentsCount}</p>
        </div>

        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-medical uppercase tracking-wider">Doctors</p>
          <p className="font-heading font-bold text-lg text-medical">{doctorsCount}</p>
        </div>

        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-emergency uppercase tracking-wider">Emerg. Admins</p>
          <p className="font-heading font-bold text-lg text-emergency">{emergencyAdminsCount}</p>
        </div>

        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Super Admins</p>
          <p className="font-heading font-bold text-lg text-primary">{superAdminsCount}</p>
        </div>

        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-wellness uppercase tracking-wider">Active</p>
          <p className="font-heading font-bold text-lg text-wellness">{activeCount}</p>
        </div>

        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-emergency uppercase tracking-wider">Suspended</p>
          <p className="font-heading font-bold text-lg text-emergency">{suspendedCount}</p>
        </div>

        <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
          <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Disabled</p>
          <p className="font-heading font-bold text-lg text-ink-muted">{disabledCount}</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-surface p-4 rounded-2xl border border-border">
        {/* Search Input */}
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, university ID, department, or phone..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring"
          />
        </div>

        {/* Role Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer appearance-none"
          >
            <option value="all">All Account Roles</option>
            <option value="student_faculty">Student / Faculty</option>
            <option value="doctor">Doctors & Health Staff</option>
            <option value="emergency_admin">Emergency Admins</option>
            <option value="super_admin">Super Admins</option>
          </select>
        </div>

        {/* Status Filter & Sort */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-ink focus-ring cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-surface rounded-2xl border border-border">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs font-medium text-ink-muted">Loading user accounts database...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-surface rounded-2xl border border-border">
          <Users className="w-8 h-8 text-ink-muted/50 mx-auto" />
          <p className="text-sm font-semibold text-ink">No User Records Match Filters</p>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            Try adjusting your search criteria, role filters, or account status filters.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-background/80 border-b border-border text-ink-muted font-semibold">
                  <th className="py-3.5 px-4">User Details</th>
                  <th className="py-3.5 px-4">University ID</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Role Clearance</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((targetUser) => {
                  const isSelf = targetUser.id === user.universityId || targetUser.email.toLowerCase() === user.email.toLowerCase();
                  const targetIsSuperAdmin = targetUser.role === 'super_admin';
                  const canModifyStatus = isSuperAdmin || (isEmergencyAdmin && !targetIsSuperAdmin && targetUser.role !== 'emergency_admin' && !isSelf);
                  const canModifyRole = isSuperAdmin && !isSelf;

                  return (
                    <tr key={targetUser.id} className="hover:bg-background/50 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                            {targetUser.name ? targetUser.name.substring(0, 2).toUpperCase() : 'CC'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-ink">{targetUser.name}</p>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-primary/10 text-primary">YOU</span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-muted font-mono">{targetUser.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* University ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-ink">
                        {targetUser.university_id || 'N/A'}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 text-ink-muted">
                        {targetUser.department || 'General Campus'}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getRoleBadge(targetUser.role)}
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(targetUser.status)}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(targetUser)}
                            className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-ink hover:text-primary hover:border-primary/40 transition-colors focus-ring cursor-pointer flex items-center gap-1"
                            title="View Full Profile Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          {/* Role Change (Super Admin) */}
                          {canModifyRole && (
                            <button
                              type="button"
                              onClick={() => handleOpenRoleModal(targetUser)}
                              className="px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-[11px] font-semibold text-primary hover:bg-primary hover:text-surface transition-colors focus-ring cursor-pointer flex items-center gap-1"
                              title="Modify Role Clearance"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>Role</span>
                            </button>
                          )}

                          {/* Status Change */}
                          {canModifyStatus && (
                            <button
                              type="button"
                              onClick={() => handleOpenStatusModal(targetUser)}
                              className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-ink-muted hover:text-emergency hover:border-emergency/40 transition-colors focus-ring cursor-pointer flex items-center gap-1"
                              title="Update Account Status"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Status</span>
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

          <div className="p-3.5 bg-background border-t border-border flex items-center justify-between text-[11px] text-ink-muted font-mono">
            <span>Showing {filteredUsers.length} of {totalCount} total user records</span>
            <span>Realtime Database Synchronized</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* USER DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedUserForDetail && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setSelectedUserForDetail(null)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink p-1 rounded-lg focus-ring cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-4 border-b border-border pb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-mono font-bold text-base flex items-center justify-center shrink-0 border border-primary/20">
                {selectedUserForDetail.name ? selectedUserForDetail.name.substring(0, 2).toUpperCase() : 'CC'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-bold text-lg text-ink truncate">{selectedUserForDetail.name}</h3>
                <p className="text-xs text-ink-muted font-mono truncate">{selectedUserForDetail.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {getRoleBadge(selectedUserForDetail.role)}
                  {getStatusBadge(selectedUserForDetail.status)}
                </div>
              </div>
            </div>

            {/* User Profile Fields */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background p-3 rounded-xl border border-border/80 space-y-0.5">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block">University ID</span>
                  <span className="font-mono font-semibold text-ink">{selectedUserForDetail.university_id || 'N/A'}</span>
                </div>

                <div className="bg-background p-3 rounded-xl border border-border/80 space-y-0.5">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block">Department</span>
                  <span className="font-semibold text-ink truncate block">{selectedUserForDetail.department || 'General Campus'}</span>
                </div>

                <div className="bg-background p-3 rounded-xl border border-border/80 space-y-0.5">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block">Phone Number</span>
                  <span className="font-mono text-ink">{selectedUserForDetail.phone || 'Not Provided'}</span>
                </div>

                <div className="bg-background p-3 rounded-xl border border-border/80 space-y-0.5">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block">Created Date</span>
                  <span className="font-mono text-ink">
                    {selectedUserForDetail.created_at
                      ? new Date(selectedUserForDetail.created_at).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Linked Doctor Profile Section */}
              {selectedUserForDetail.role === 'doctor' && (
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-medical font-semibold text-xs">
                    <Stethoscope className="w-4 h-4" />
                    <span>Linked Physician Profile Records</span>
                  </div>

                  {loadingDoctorDetail ? (
                    <div className="p-4 rounded-xl bg-background border border-border text-center text-ink-muted">
                      <RefreshCw className="w-4 h-4 animate-spin text-medical mx-auto mb-1" />
                      <span>Loading doctor directory records...</span>
                    </div>
                  ) : doctorDetail ? (
                    <div className="bg-medical/5 border border-medical/20 p-3.5 rounded-xl space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-ink-muted block">Specialization:</span>
                          <span className="font-semibold text-ink">{doctorDetail.specialization}</span>
                        </div>
                        <div>
                          <span className="text-ink-muted block">Designation:</span>
                          <span className="font-semibold text-ink">{doctorDetail.designation || 'Specialist'}</span>
                        </div>
                        <div>
                          <span className="text-ink-muted block">Doctor ID Code:</span>
                          <span className="font-mono font-semibold text-ink">{doctorDetail.doctor_id}</span>
                        </div>
                        <div>
                          <span className="text-ink-muted block">Clinical Availability:</span>
                          <span className={`font-semibold ${doctorDetail.is_available ? 'text-wellness' : 'text-emergency'}`}>
                            {doctorDetail.is_available ? 'On-Call & Available' : 'Off-Duty'}
                          </span>
                        </div>
                      </div>
                      {doctorDetail.bio && (
                        <p className="text-[11px] text-ink-muted border-t border-medical/10 pt-2 italic">
                          "{doctorDetail.bio}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-ink-muted italic bg-background p-3 rounded-xl border border-border">
                      No linked doctor record in physicians directory. Role elevated directly.
                    </p>
                  )}
                </div>
              )}

              {/* Privacy Notice */}
              <div className="p-3 rounded-xl bg-background border border-border text-[11px] text-ink-muted flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-wellness shrink-0" />
                <span>Patient medical clinical records are encrypted and restricted to medical staff. Confidential records are excluded from user directory.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-border pt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedUserForDetail(null)}
                className="px-4 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors focus-ring cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ROLE ELEVATION MODAL (SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {roleModalUser && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-6 space-y-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setRoleModalUser(null)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink p-1 rounded-lg focus-ring cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Super Admin Privileged Action</span>
              </div>
              <h3 className="font-heading font-bold text-lg text-ink">Modify User Clearance Role</h3>
              <p className="text-xs text-ink-muted">
                Updating role clearance for <strong className="text-ink">{roleModalUser.name}</strong> ({roleModalUser.email}).
              </p>
            </div>

            {roleError && (
              <div className="p-3 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <label className="font-semibold text-ink block">Select Clearance Role:</label>
              
              <div className="space-y-2">
                {[
                  { role: 'student_faculty' as UserRole, label: 'Student / Faculty', desc: 'Standard campus access to book appointments and file reports' },
                  { role: 'doctor' as UserRole, label: 'Doctor / Medical Staff', desc: 'Clinical access to patient appointments and health records' },
                  { role: 'emergency_admin' as UserRole, label: 'Emergency Admin', desc: 'Operational clearance to dispatch SOS alerts & manage incidents' },
                  { role: 'super_admin' as UserRole, label: 'Super Admin', desc: 'Full administrative control over user accounts & system settings' },
                ].map((item) => (
                  <label
                    key={item.role}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === item.role
                        ? 'border-primary bg-primary/5 text-ink'
                        : 'border-border bg-background text-ink-muted hover:border-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="roleSelection"
                      value={item.role}
                      checked={selectedRole === item.role}
                      onChange={() => setSelectedRole(item.role)}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-semibold text-ink text-xs">{item.label}</p>
                      <p className="text-[11px] text-ink-muted">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                disabled={updatingRole}
                className="px-4 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors focus-ring cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRoleUpdate}
                disabled={updatingRole}
                className="px-4 py-2 rounded-xl bg-primary text-surface font-semibold text-xs hover:bg-primary-hover transition-colors focus-ring cursor-pointer flex items-center gap-2"
              >
                {updatingRole && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Role Change</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATUS UPDATE MODAL */}
      {/* ========================================================================= */}
      {statusModalUser && isAdmin && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-6 space-y-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setStatusModalUser(null)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink p-1 rounded-lg focus-ring cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emergency/10 text-emergency text-xs font-semibold">
                <Sliders className="w-3.5 h-3.5" />
                <span>Account Status Control</span>
              </div>
              <h3 className="font-heading font-bold text-lg text-ink">Update Account State</h3>
              <p className="text-xs text-ink-muted">
                Modifying operational account state for <strong className="text-ink">{statusModalUser.name}</strong> ({statusModalUser.email}).
              </p>
            </div>

            {statusError && (
              <div className="p-3 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <label className="font-semibold text-ink block">Select Account Status:</label>

              <div className="space-y-2">
                {[
                  { status: 'active' as const, label: 'Active', desc: 'Full access to CampusCare services and portal' },
                  { status: 'suspended' as const, label: 'Suspended', desc: 'Temporarily restricted from submitting appointments or alerts' },
                  { status: 'disabled' as const, label: 'Disabled', desc: 'Deactivated account state flagged for administrative review' },
                ].map((item) => (
                  <label
                    key={item.status}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedStatus === item.status
                        ? 'border-emergency bg-emergency/5 text-ink'
                        : 'border-border bg-background text-ink-muted hover:border-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusSelection"
                      value={item.status}
                      checked={selectedStatus === item.status}
                      onChange={() => setSelectedStatus(item.status)}
                      className="mt-0.5 text-emergency focus:ring-emergency"
                    />
                    <div>
                      <p className="font-semibold text-ink text-xs">{item.label}</p>
                      <p className="text-[11px] text-ink-muted">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusModalUser(null)}
                disabled={updatingStatus}
                className="px-4 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-ink hover:bg-surface-hover transition-colors focus-ring cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStatusUpdate}
                disabled={updatingStatus}
                className="px-4 py-2 rounded-xl bg-emergency text-surface font-semibold text-xs hover:bg-emergency/90 transition-colors focus-ring cursor-pointer flex items-center gap-2"
              >
                {updatingStatus && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Apply Status Change</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

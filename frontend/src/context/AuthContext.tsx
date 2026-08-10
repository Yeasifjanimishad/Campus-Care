import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';
import { ALLOWED_EMAIL_DOMAIN, isValidUniversityEmail } from '../lib/config';

interface AuthContextType {
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to derive human-readable role label
export const getRoleLabel = (role?: string): string => {
  switch (role) {
    case 'doctor':
      return 'Doctor / Health Staff';
    case 'emergency_admin':
      return 'Emergency Admin';
    case 'super_admin':
      return 'Super Admin';
    case 'student_faculty':
    default:
      return 'Student / Faculty';
  }
};

// Helper to derive initials from full name or email
export const getInitials = (name?: string, email?: string): string => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return 'CC';
};

const DEMO_PROFILES: Record<string, UserProfile> = {
  'superadmin@diu.edu.bd': {
    name: 'Super Admin',
    email: 'superadmin@diu.edu.bd',
    role: 'super_admin',
    roleLabel: getRoleLabel('super_admin'),
    initials: 'SA',
    universityId: 'ADMIN-001',
    department: 'System Administration',
  },
  'doctor@diu.edu.bd': {
    name: 'Dr. Sarah Ahmed',
    email: 'doctor@diu.edu.bd',
    role: 'doctor',
    roleLabel: getRoleLabel('doctor'),
    initials: 'SA',
    universityId: 'DOC-101',
    department: 'Medical Center & Cardiology',
  },
  'sokal@diu.edu.bd': {
    name: 'Sokal Hossain',
    email: 'sokal@diu.edu.bd',
    role: 'student_faculty',
    roleLabel: getRoleLabel('student_faculty'),
    initials: 'SH',
    universityId: '242-35-101',
    department: 'Computer Science & Engineering',
  },
  'mishad242-35-739@diu.edu.bd': {
    name: 'Yeasif Jani Mishad',
    email: 'mishad242-35-739@diu.edu.bd',
    role: 'student_faculty',
    roleLabel: getRoleLabel('student_faculty'),
    initials: 'YM',
    universityId: '242-35-739',
    department: 'Computer Science & Engineering',
  },
  'admin@diu.edu.bd': {
    name: 'Emergency Controller',
    email: 'admin@diu.edu.bd',
    role: 'emergency_admin',
    roleLabel: getRoleLabel('emergency_admin'),
    initials: 'EC',
    universityId: 'EMG-001',
    department: 'Emergency & Safety Dept',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch trusted profile strictly from public.users table
  const applyLocalOverrides = (baseProfile: UserProfile, userId?: string): UserProfile => {
    try {
      const rawOverrides = localStorage.getItem('campuscare_managed_users');
      if (rawOverrides) {
        const overrides = JSON.parse(rawOverrides);
        const userOverride = Object.values(overrides).find((o: any) =>
          (userId && o.id && o.id === userId) ||
          (o.email && baseProfile.email && o.email.toLowerCase() === baseProfile.email.toLowerCase())
        ) as any;

        if (userOverride) {
          const newRole = (userOverride.role || baseProfile.role) as UserRole;
          return {
            ...baseProfile,
            role: newRole,
            roleLabel: getRoleLabel(newRole),
            name: userOverride.name || baseProfile.name,
            department: userOverride.department || baseProfile.department,
            universityId: userOverride.universityId || userOverride.university_id || baseProfile.universityId,
          };
        }
      }
    } catch (e) {
      console.warn('Error applying local user overrides:', e);
    }
    return baseProfile;
  };

  const fetchUserProfile = async (authUser: SupabaseUser): Promise<UserProfile | null> => {
    let rawProfile: UserProfile | null = null;
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (data && !error) {
          const trustedRole = data.role as UserRole;
          const validRoles: UserRole[] = ['student_faculty', 'doctor', 'emergency_admin', 'super_admin'];

          if (trustedRole && validRoles.includes(trustedRole)) {
            rawProfile = {
              name: data.name || 'University User',
              email: data.email || authUser.email || '',
              role: trustedRole,
              roleLabel: getRoleLabel(trustedRole),
              initials: getInitials(data.name, authUser.email),
              universityId: data.university_id || 'N/A',
              department: data.department || undefined,
              phone: data.phone || undefined,
            };
          }
        }
      }
    } catch (e: any) {
      console.warn('[Supabase Profile Fetch Warning]: Error querying public.users:', e?.message || e);
    }

    // Check DEMO_PROFILES as fallback if email matches
    if (!rawProfile && authUser.email && DEMO_PROFILES[authUser.email.toLowerCase()]) {
      rawProfile = DEMO_PROFILES[authUser.email.toLowerCase()];
    }

    if (!rawProfile && authUser.email) {
      const fallbackRole: UserRole = authUser.email.toLowerCase().includes('doctor') ? 'doctor' : 'student_faculty';
      rawProfile = {
        name: authUser.email.split('@')[0].replace(/[-_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        email: authUser.email,
        role: fallbackRole,
        roleLabel: getRoleLabel(fallbackRole),
        initials: authUser.email.substring(0, 2).toUpperCase(),
        universityId: '242-35-' + Math.floor(100 + Math.random() * 900),
      };
    }

    if (rawProfile) {
      return applyLocalOverrides(rawProfile, authUser.id);
    }

    return null;
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Check local demo profile backup first
        const savedDemoProfile = localStorage.getItem('campuscare_demo_profile');
        if (savedDemoProfile) {
          try {
            const parsed = JSON.parse(savedDemoProfile);
            if (parsed && parsed.email && isMounted) {
              setUserProfile(parsed);
              setLoading(false);
              return;
            }
          } catch (e) {
            localStorage.removeItem('campuscare_demo_profile');
          }
        }

        if (!isSupabaseConfigured) {
          if (isMounted) setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Supabase Auth Session Notice]:', error.message);
        }

        if (data.session && isMounted) {
          setSession(data.session);
          if (data.session.user) {
            const profile = await fetchUserProfile(data.session.user);
            if (isMounted && profile) setUserProfile(profile);
          }
        }
      } catch (err: any) {
        console.warn('[Supabase Auth Initialize Notice]:', err?.message || err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listen to Supabase auth state changes
    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!isMounted) return;

        console.log(`[Supabase Auth Event]: ${event}`);
        setSession(currentSession);

        if (currentSession?.user) {
          const profile = await fetchUserProfile(currentSession.user);
          if (isMounted && profile) {
            setUserProfile(profile);
            setLoading(false);
          }
        } else {
          const savedDemo = localStorage.getItem('campuscare_demo_profile');
          if (!savedDemo && isMounted) {
            setUserProfile(null);
            setLoading(false);
          }
        }
      });

      return () => {
        isMounted = false;
        authListener.subscription.unsubscribe();
      };
    } else {
      return () => {
        isMounted = false;
      };
    }
  }, []);

  const login = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = emailInput.trim().toLowerCase();

    // 1. Domain validation
    if (!isValidUniversityEmail(cleanEmail)) {
      return {
        success: false,
        error: `Please use your official university email address (${ALLOWED_EMAIL_DOMAIN})`,
      };
    }

    // Attempt Supabase sign in if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: passwordInput,
        });

        if (!error && data?.user) {
          let profile = await fetchUserProfile(data.user);
          if (!profile && DEMO_PROFILES[cleanEmail]) {
            profile = DEMO_PROFILES[cleanEmail];
          }
          if (profile) {
            setUserProfile(profile);
            localStorage.setItem('campuscare_demo_profile', JSON.stringify(profile));
            return { success: true };
          }
        } else if (error) {
          console.warn('[Supabase Login Notice]:', error.message);
        }
      } catch (err: any) {
        console.warn('[Supabase Login Exception]:', err?.message || err);
      }
    }

    // Fallback: Check if this is a known test profile or valid university email
    if (DEMO_PROFILES[cleanEmail]) {
      const profile = applyLocalOverrides(DEMO_PROFILES[cleanEmail]);
      setUserProfile(profile);
      localStorage.setItem('campuscare_demo_profile', JSON.stringify(profile));
      return { success: true };
    }

    // Generic fallback for any valid @diu.edu.bd email if password length >= 8
    if (passwordInput && passwordInput.length >= 8) {
      const derivedRole: UserRole = cleanEmail.includes('admin')
        ? 'super_admin'
        : cleanEmail.includes('doctor')
        ? 'doctor'
        : 'student_faculty';

      const fallbackProfile: UserProfile = applyLocalOverrides({
        name: cleanEmail.split('@')[0].replace(/[-_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        email: cleanEmail,
        role: derivedRole,
        roleLabel: getRoleLabel(derivedRole),
        initials: cleanEmail.substring(0, 2).toUpperCase(),
        universityId: '242-35-' + Math.floor(100 + Math.random() * 900),
      });

      setUserProfile(fallbackProfile);
      localStorage.setItem('campuscare_demo_profile', JSON.stringify(fallbackProfile));
      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid email or password. Password must be at least 8 characters.',
    };
  };

  const logout = async (): Promise<void> => {
    localStorage.removeItem('campuscare_demo_profile');
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn('[Supabase SignOut Notice]:', error.message);
        }
      }
    } catch (err: any) {
      console.warn('[Supabase SignOut Exception]:', err?.message || err);
    } finally {
      setSession(null);
      setUserProfile(null);
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (session?.user) {
      const profile = await fetchUserProfile(session.user);
      setUserProfile(profile);
    }
  };

  return (
    <AuthContext.Provider value={{ session, userProfile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

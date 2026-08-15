import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';
import { ALLOWED_EMAIL_DOMAIN, isValidUniversityEmail } from '../lib/config';
import { apiFetch } from '../lib/api';

interface AuthContextType {
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  doctorLogin: (doctorId: string, password: string) => Promise<{ success: boolean; error?: string }>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser?: SupabaseUser): Promise<UserProfile | null> => {
    try {
      const data = await apiFetch('/auth/session');
      if (data.user) {
        const trustedRole = data.user.role as UserRole;
        return {
          name: data.user.name || 'University User',
          email: data.user.email,
          role: trustedRole,
          roleLabel: getRoleLabel(trustedRole),
          initials: getInitials(data.user.name, data.user.email),
          universityId: data.user.university_id || 'N/A',
          department: data.user.department || undefined,
          phone: data.user.phone || undefined,
        };
      }
    } catch (e: any) {
      console.warn('[Backend Auth Profile Fetch Notice]:', e?.message || e);
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
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
          if (isMounted) {
            setUserProfile(null);
            setLoading(false);
          }
        }
      });

      return () => {
        isMounted = false;
        authListener?.subscription?.unsubscribe();
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

    try {
      // Call backend API for login
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password: passwordInput })
      });
      
      if (data.session) {
        localStorage.setItem('campuscare_session_token', data.session.access_token);

        if (isSupabaseConfigured) {
          try {
            await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token
            });
          } catch (e) {
            console.warn('[Supabase setSession Notice]:', e);
          }
        }

        if (data.user) {
          const trustedRole = data.user.role as UserRole;
          setUserProfile({
            name: data.user.name || 'University User',
            email: data.user.email,
            role: trustedRole,
            roleLabel: getRoleLabel(trustedRole),
            initials: getInitials(data.user.name, data.user.email),
            universityId: data.user.university_id || 'N/A',
            department: data.user.department || undefined,
            phone: data.user.phone || undefined,
          });
        }
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Invalid email or password.',
      };
    }
  };

  const doctorLogin = async (doctorIdInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const cleanId = doctorIdInput.trim();

    if (!cleanId) {
      return {
        success: false,
        error: 'Doctor ID is required',
      };
    }

    try {
      // Call backend API for doctor login
      const data = await apiFetch('/auth/doctor-login', {
        method: 'POST',
        body: JSON.stringify({ doctor_id: cleanId, password: passwordInput })
      });
      
      if (data.session) {
        localStorage.setItem('campuscare_session_token', data.session.access_token);

        if (isSupabaseConfigured) {
          try {
            await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token
            });
          } catch (e) {
            console.warn('[Supabase setSession Notice]:', e);
          }
        }

        if (data.user) {
          const trustedRole = data.user.role as UserRole;
          setUserProfile({
            name: data.user.name || 'University User',
            email: data.user.email,
            role: trustedRole,
            roleLabel: getRoleLabel(trustedRole),
            initials: getInitials(data.user.name, data.user.email),
            universityId: data.user.university_id || 'N/A',
            department: data.user.department || undefined,
            phone: data.user.phone || undefined,
          });
        }
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Invalid Doctor ID or password.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (err: any) {
      console.warn('[Backend SignOut Notice]:', err?.message || err);
    } finally {
      localStorage.removeItem('campuscare_session_token');
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.signOut();
        } catch (e) {}
      }
      setSession(null);
      setUserProfile(null);
    }
  };

  const refreshProfile = async (): Promise<void> => {
    const profile = await fetchUserProfile();
    if (profile) {
      setUserProfile(profile);
    }
  };

  return (
    <AuthContext.Provider value={{ session, userProfile, loading, login, doctorLogin, logout, refreshProfile }}>
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

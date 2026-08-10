import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, PageRoute } from '../types';
import { getRoleDashboardRoute } from '../lib/routes';
import { Loader2, HeartPulse } from 'lucide-react';

interface RoleRouteProps {
  allowedRoles?: UserRole[];
  currentRoute: PageRoute;
  onRedirect: (route: PageRoute) => void;
  children: React.ReactNode;
}

/**
 * Role-Based Route Guard Component
 * Ensures user is authenticated and possesses one of the allowed roles for a route.
 * Redirects unauthorized users to their own role-specific dashboard.
 */
export const RoleRoute: React.FC<RoleRouteProps> = ({
  allowedRoles,
  currentRoute,
  onRedirect,
  children,
}) => {
  const { userProfile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!userProfile) {
      // Unauthenticated user attempting to access protected route
      onRedirect('login');
      return;
    }

    // Role check: if route restricts roles and user role is not permitted,
    // silently redirect to user's assigned role dashboard
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userProfile.role)) {
      const correctRoute = getRoleDashboardRoute(userProfile.role);
      if (currentRoute !== correctRoute) {
        onRedirect(correctRoute);
      }
    }
  }, [userProfile, loading, allowedRoles, currentRoute, onRedirect]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-surface flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
          <HeartPulse className="w-6 h-6 text-medical" />
        </div>
        <div className="flex items-center gap-2 text-ink text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Verifying role permissions...</span>
        </div>
      </div>
    );
  }

  if (!userProfile) return null;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userProfile.role)) {
    return null;
  }

  return <>{children}</>;
};

import { UserRole, PageRoute } from '../types';

/**
 * Mapping of user roles to their primary role-specific dashboard routes
 */
export const ROLE_DASHBOARD_ROUTES: Record<UserRole, PageRoute> = {
  student_faculty: 'dashboard/student',
  doctor: 'dashboard/doctor',
  emergency_admin: 'dashboard/admin',
  super_admin: 'dashboard/super-admin',
};

/**
 * Get the target dashboard route for a given user role
 */
export const getRoleDashboardRoute = (role?: UserRole): PageRoute => {
  if (!role || !(role in ROLE_DASHBOARD_ROUTES)) {
    return 'dashboard/student';
  }
  return ROLE_DASHBOARD_ROUTES[role];
};

/**
 * Check if a route path is any dashboard route
 */
export const isDashboardRoute = (route: string): boolean => {
  return (
    route === 'dashboard' ||
    route === 'dashboard/student' ||
    route === 'dashboard/doctor' ||
    route === 'dashboard/admin' ||
    route === 'dashboard/super-admin'
  );
};

/**
 * Check if a route is a valid route in the app
 */
export const isValidRoute = (route: string): boolean => {
  const validRoutes = [
    'landing',
    'login',
    'signup',
    'doctor/request-access',
    'dashboard',
    'dashboard/student',
    'dashboard/doctor',
    'dashboard/admin',
    'dashboard/super-admin',
    'appointments',
    'alerts',
    'reports',
    'records',
    'notifications',
    'profile',
  ];
  return validRoutes.includes(route);
};

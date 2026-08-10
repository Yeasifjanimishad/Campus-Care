import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { DoctorRequestAccessPage } from './pages/DoctorRequestAccess';
import { DashboardPage } from './pages/Dashboard';
import { RoleRoute } from './components/RoleRoute';
import { PageRoute, AppNavId } from './types';
import { getRoleDashboardRoute, isDashboardRoute, isValidRoute } from './lib/routes';
import { Loader2, HeartPulse } from 'lucide-react';

function AppMain() {
  const { userProfile, loading, logout } = useAuth();

  const [currentRoute, setCurrentRoute] = useState<PageRoute>('landing');
  const [activeNav, setActiveNav] = useState<AppNavId>('dashboard');

  const NAV_ROUTES = ['appointments', 'alerts', 'reports', 'records', 'notifications', 'profile'];

  // Hash listener for navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');

      if (hash === 'login') {
        setCurrentRoute('login');
      } else if (hash === 'signup') {
        setCurrentRoute('signup');
      } else if (hash === 'doctor/request-access') {
        setCurrentRoute('doctor/request-access');
      } else if (hash === 'landing' || hash === '') {
        setCurrentRoute('landing');
      } else if (
        hash === 'dashboard' ||
        hash === 'dashboard/student' ||
        hash === 'dashboard/doctor' ||
        hash === 'dashboard/admin' ||
        hash === 'dashboard/super-admin'
      ) {
        setCurrentRoute(hash as PageRoute);
        setActiveNav('dashboard');
      } else if (NAV_ROUTES.includes(hash)) {
        setActiveNav(hash as AppNavId);
        setCurrentRoute(hash as PageRoute);
      } else {
        // Unknown or custom route
        setCurrentRoute(hash as PageRoute);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route: PageRoute) => {
    setCurrentRoute(route);
    window.location.hash = route;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavChange = (nav: AppNavId) => {
    setActiveNav(nav);
    if (nav === 'dashboard') {
      const targetRoute = userProfile ? getRoleDashboardRoute(userProfile.role) : 'dashboard/student';
      window.location.hash = targetRoute;
    } else {
      window.location.hash = nav;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await logout();
    navigateTo('landing');
  };

  // Central Role-Based Route Guard & Redirect Logic
  useEffect(() => {
    if (loading) return;

    // 1. Unauthenticated user logic
    if (!userProfile) {
      if (isDashboardRoute(currentRoute) || NAV_ROUTES.includes(currentRoute)) {
        navigateTo('login');
      } else if (!isValidRoute(currentRoute)) {
        navigateTo('landing');
      }
      return;
    }

    // 2. Authenticated user logic
    const userRoleDashboard = getRoleDashboardRoute(userProfile.role);

    // If logged-in user visits auth pages or base 'dashboard' route, send to their role dashboard
    if (currentRoute === 'login' || currentRoute === 'signup' || currentRoute === 'dashboard') {
      navigateTo(userRoleDashboard);
      return;
    }

    // If logged-in user visits a role dashboard that doesn't match their role
    if (isDashboardRoute(currentRoute) && currentRoute !== userRoleDashboard) {
      navigateTo(userRoleDashboard);
      return;
    }

    // Fallback: If logged-in user visits an unknown/invalid route
    if (!isValidRoute(currentRoute)) {
      navigateTo(userRoleDashboard);
      return;
    }
  }, [userProfile, currentRoute, loading]);

  // Global loading state while checking session persistence
  if (loading) {
    return (
      <div className="w-full min-h-screen bg-surface flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
          <HeartPulse className="w-6 h-6 text-medical" />
        </div>
        <div className="flex items-center gap-2 text-ink text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Authenticating session with CampusCare...</span>
        </div>
      </div>
    );
  }

  // Determine if currently rendering a dashboard layout view
  const isCurrentlyDashboard = Boolean(userProfile) && (isDashboardRoute(currentRoute) || NAV_ROUTES.includes(currentRoute) || NAV_ROUTES.includes(activeNav));

  return (
    <div className="w-full min-h-screen">
      {currentRoute === 'landing' && <LandingPage onNavigate={navigateTo} />}
      {currentRoute === 'login' && <LoginPage onNavigate={navigateTo} />}
      {currentRoute === 'signup' && <SignupPage onNavigate={navigateTo} />}
      {currentRoute === 'doctor/request-access' && <DoctorRequestAccessPage onNavigate={navigateTo} />}
      
      {/* Role-Guarded Dashboard Routes */}
      {isCurrentlyDashboard && userProfile && (
        <RoleRoute
          currentRoute={currentRoute}
          onRedirect={navigateTo}
        >
          <DashboardPage
            onNavigateRoute={navigateTo}
            activeNav={activeNav}
            onNavChange={handleNavChange}
            user={userProfile}
            onLogout={handleLogout}
          />
        </RoleRoute>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppMain />
    </AuthProvider>
  );
}

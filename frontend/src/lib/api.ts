import { supabase, isSupabaseConfigured } from './supabase';

const BASE_URL = '/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  
  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } else {
    // Fallback to local storage for mock auth
    const token = localStorage.getItem('campuscare_session_token') || localStorage.getItem('campuscare_mock_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  
  // Set Content-Type to JSON if not explicitly set and body is not FormData
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('campuscare_session_token');
      localStorage.removeItem('campuscare_mock_token');
    }
    window.location.hash = 'login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Request failed with status ${response.status}`);
  }

  return response.json();
};

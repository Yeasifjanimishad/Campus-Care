import { supabase } from './supabase';

const BASE_URL = '/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers || {});
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Optionally trigger a logout event if unauthorized
    await supabase.auth.signOut();
    window.location.hash = 'login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Request failed with status ${response.status}`);
  }

  return response.json();
};

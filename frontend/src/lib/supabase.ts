import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://hyenslxslxotpnmwskve.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZW5zbHhzbHhvdHBubXdza3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTY5NzEsImV4cCI6MjEwMTc3Mjk3MX0.sjW2PfD4HJ2lCWpEokDCbgPsqs-VT8VCOpNXlOCw6c4';

let rawUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
let rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

// Handle edge case where user accidentally swapped URL and ANON KEY in environment variables
if ((rawUrl.startsWith('sb_') || rawUrl.startsWith('eyJ')) && (rawKey.startsWith('http://') || rawKey.startsWith('https://'))) {
  console.log('[Supabase Config]: Detected swapped environment variables. Auto-correcting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  const temp = rawUrl;
  rawUrl = rawKey;
  rawKey = temp;
}

export const supabaseUrl = rawUrl;
export const supabaseAnonKey = rawKey;

/**
 * Indicates whether valid Supabase environment variables are provided
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('unconfigured')
);

// Safe diagnostic log on startup (only reports existence, NEVER prints actual secrets)
if (typeof window !== 'undefined') {
  console.log('[Supabase Environment Diagnostics]:', {
    VITE_SUPABASE_URL_EXISTS: Boolean(supabaseUrl),
    VITE_SUPABASE_ANON_KEY_EXISTS: Boolean(supabaseAnonKey),
    IS_CONFIGURED: isSupabaseConfigured,
  });
}

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase Configuration Warning]: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid. Please configure these environment variables.'
  );
}

/**
 * Supabase Client Instance
 */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://unconfigured.supabase.co', 
  isSupabaseConfigured ? supabaseAnonKey : 'unconfigured'
);


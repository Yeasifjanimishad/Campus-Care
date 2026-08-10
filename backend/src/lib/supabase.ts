import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

const DEFAULT_SUPABASE_URL = 'https://hyenslxslxotpnmwskve.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZW5zbHhzbHhvdHBubXdza3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTY5NzEsImV4cCI6MjEwMTc3Mjk3MX0.sjW2PfD4HJ2lCWpEokDCbgPsqs-VT8VCOpNXlOCw6c4';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket as any,
  },
});

export const createAuthClient = (token: string) => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    realtime: {
      transport: WebSocket as any,
    },
  });
};


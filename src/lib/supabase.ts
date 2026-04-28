/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isMissingSupabaseConfig = !supabaseUrl || 
                   !supabaseAnonKey || 
                   supabaseUrl === 'https://your-project.supabase.co' || 
                   supabaseAnonKey === 'your-anon-key';

// Check for missing VITE_ prefix (common mistake)
const hasNonViteKeys = (process.env as any).SUPABASE_URL || (process.env as any).SUPABASE_ANON_KEY;

if (isMissingSupabaseConfig) {
  if (hasNonViteKeys) {
    console.warn('Supabase credentials found but missing "VITE_" prefix. Variables must start with VITE_ to be accessible in the browser.');
  } else {
    console.warn('Supabase credentials missing or using placeholders. Using mock data mode.');
  }
}

export const supabase = !isMissingSupabaseConfig 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

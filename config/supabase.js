import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { config } from './config.js';

// Create the regular client for normal operations
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        defaultOptions: {
            emailRedirectTo: VERIFY_EMAIL_URL
        }
    }
});
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { config } from './config.js';

// Export the verify email URL for use in other modules
export const VERIFY_EMAIL_URL = config.verifyEmailUrl;

// Create the regular client for normal operations
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        defaultOptions: {
            emailRedirectTo: config.verifyEmailUrl
        }
    }
});

// Create admin client for server-side operations (requires service role key)
// Note: This should only be used on the server side with proper service role key
export const supabaseAdmin = createClient(
    config.supabaseUrl, 
    config.supabaseServiceKey || config.supabaseAnonKey, // Fallback to anon key if service key not available
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);
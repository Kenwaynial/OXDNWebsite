import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { config } from './config.js';

// Export the verify email URL for use in other modules
export const VERIFY_EMAIL_URL = config.verifyEmailUrl;

// Create a singleton Supabase client to avoid multiple instances
let supabaseInstance = null;

// Function to get or create the Supabase client (singleton pattern)
function getSupabaseClient() {
    if (!supabaseInstance) {
        supabaseInstance = createClient(config.supabaseUrl, config.supabaseAnonKey, {
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
    }
    return supabaseInstance;
}

// Export the singleton client
export const supabase = getSupabaseClient();

// For backward compatibility, export the same client as admin
// (since we don't have actual service role key on client-side)
export const supabaseAdmin = supabase;
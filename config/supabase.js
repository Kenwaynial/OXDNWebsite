import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = 'https://ncehdvoeausqrzjohgll.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZWhkdm9lYXVzcXJ6am9oZ2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NDYwODIsImV4cCI6MjA2NDEyMjA4Mn0.DkV7MvbzShMu8kps7bzad25wVjMH-N6l-MHagaKfvF0';

// Site URL configuration
export const SITE_URL = 'https://oxdn.vercel.app';
export const VERIFY_EMAIL_URL = `${SITE_URL}/html/verifyEmail.html`;
export const RESET_PASSWORD_URL = `${SITE_URL}/html/auth/resetPassword.html`;
export const AUTH_CALLBACK_URL = `${SITE_URL}/auth/callback`;

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
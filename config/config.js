// Environment variables for client-side use
// Note: These values are public and exposed to the client
export const config = {
    supabaseUrl: window.__SUPABASE_URL__ || 'https://ncehdvoeausqrzjohgll.supabase.co',
    supabaseAnonKey: window.__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZWhkdm9lYXVzcXJ6am9oZ2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2Njg0NzIsImV4cCI6MjA0OTI0NDQ3Mn0.Q3D3UaLDj4FKIEUyq-u-cKrF5XMYKKZqX9YZvn6oYYw',
    supabaseServiceKey: window.__SUPABASE_SERVICE_KEY__, // For admin operations
    siteUrl: window.location.origin || 'https://oxdn.vercel.app',
    get verifyEmailUrl() {
        return `${this.siteUrl}/html/verifyEmail.html`;
    },
    get resetPasswordUrl() {
        return `${this.siteUrl}/html/auth/resetPassword.html`;
    },
    get authCallbackUrl() {
        return `${this.siteUrl}/auth/callback`;
    }
};

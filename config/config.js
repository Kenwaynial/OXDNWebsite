// Environment variables for client-side use
// Note: These values are public and exposed to the client
export const config = {
    supabaseUrl: window.__SUPABASE_URL__ || 'https://ncehdvoeausqrzjohgll.supabase.co',
    supabaseAnonKey: window.__SUPABASE_ANON_KEY__,
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

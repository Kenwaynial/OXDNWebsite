// Environment variables for client-side use
// Note: These values are public and exposed to the client
export const config = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ncehdvoeausqrzjohgll.supabase.co',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

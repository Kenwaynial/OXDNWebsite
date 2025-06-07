import { supabase, supabaseAdmin } from '../config/supabase.js';
import { VERIFY_EMAIL_URL } from '../config/supabase.js';

/**
 * Validates a username string
 * @param {string} username - The username to validate
 * @returns {Object} Object containing isValid and message
 */
const validateUsername = (username) => {
    if (!username || username.length < 3) {
        return {
            isValid: false,
            message: 'Username must be at least 3 characters long'
        };
    }
    if (username.length > 30) {
        return {
            isValid: false,
            message: 'Username must not exceed 30 characters'
        };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return {
            isValid: false,
            message: 'Username can only contain letters, numbers, and underscores'
        };
    }
    return { isValid: true };
};

/**
 * Validates an email string
 * @param {string} email - The email to validate
 * @returns {Object} Object containing isValid and message
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return {
            isValid: false,
            message: 'Please enter a valid email address'
        };
    }
    return { isValid: true };
};

/**
 * Validates a password string
 * @param {string} password - The password to validate
 * @returns {Object} Object containing isValid and message
 */
const validatePassword = (password) => {
    if (!password || password.length < 6) {
        return {
            isValid: false,
            message: 'Password must be at least 6 characters long'
        };
    }
    if (!/\d/.test(password)) {
        return {
            isValid: false,
            message: 'Password must contain at least one number'
        };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return {
            isValid: false,
            message: 'Password must contain at least one special character'
        };
    }
    return { isValid: true };
};

/**
 * Checks if a username is available
 * @param {string} username - The username to check
 * @returns {Promise<Object>} Object containing isAvailable and message
 */
export const checkUsernameAvailability = async (username) => {
    try {
        // Direct database query instead of RPC
        const { data: existingUsers, error } = await supabase
            .from('profiles')
            .select('username')
            .ilike('username', username)
            .limit(1);

        if (error) throw error;

        return {
            isAvailable: !existingUsers?.length,
            message: existingUsers?.length ? 'Username is already taken' : 'Username is available'
        };
    } catch (error) {
        console.error('Username check error:', error);
        return { isAvailable: false, message: 'Error checking username' };
    }
};

/**
 * Checks if an email is available
 * @param {string} email - The email to check
 * @returns {Promise<Object>} Object containing isAvailable and message
 */
export const checkEmailAvailability = async (email) => {
    try {
        const { data: existingUsers, error } = await supabase
            .from('profiles')
            .select('email')
            .eq('email', email)
            .limit(1);

        if (error) {
            console.error('Email check error:', error);
            throw error;
        }

        return {
            isAvailable: !existingUsers?.length,
            message: existingUsers?.length ? 'Email is already registered' : 'Email is available'
        };
    } catch (error) {
        console.error('Email availability check failed:', error);
        return {
            isAvailable: false,
            message: 'Error checking email availability'
        };
    }
};

// Main registration function is now handled by register()

/**
 * Register a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} username - User's username
 * @returns {Promise<Object>} Registration result
 */
export async function register(email, password, username) {
    try {
        console.log('Starting registration validation for:', { email, username });
        
        // Validate input
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return { success: false, message: emailValidation.message };
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return { success: false, message: passwordValidation.message };
        }

        const usernameValidation = validateUsername(username);
        if (!usernameValidation.isValid) {
            return { success: false, message: usernameValidation.message };
        }        // Check for existing account with admin client
        const { data: existingAccount } = await supabaseAdmin
            .from('profiles')
            .select('email_verified')
            .eq('email', email)
            .maybeSingle();

        if (existingAccount) {
            console.log('Found existing account:', existingAccount);
            if (existingAccount.email_verified) {
                return {
                    success: false,
                    message: 'This email is already registered. Please log in instead.',
                    alreadyRegistered: true
                };
            }
            // Clean up unverified account
            const cleanupResult = await cleanupUnverifiedAccount(email);
            if (!cleanupResult.success) {
                return cleanupResult;
            }
        }        // Check username availability using admin client
        const { data: takenUsername } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('username', username)
            .maybeSingle();

        if (takenUsername) {
            return {
                success: false,
                message: 'This username is already taken. Please choose another.'
            };
        }

        console.log('All validations passed, creating auth user...');

        // Create the auth user with minimal data
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: VERIFY_EMAIL_URL
            }
        });

        if (authError) {
            console.error('Auth signup error:', authError);
            if (authError.message.includes('User already registered')) {
                return {
                    success: false,
                    message: 'This email is already registered. Please verify your email to continue.',
                    needsVerification: true,
                    email: email
                };
            }
            throw authError;
        }        if (!authData?.user?.id) {
            console.error('No user data returned:', authData);
            throw new Error('Failed to create user account - no user ID returned');
        }

        console.log('Auth user created successfully:', { userId: authData.user.id });        // Create the user's profile using admin client
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: authData.user.id,
                username: username,
                email: email,
                created_at: new Date().toISOString()
            });        if (profileError) {
            console.error('Profile creation error:', profileError);
            try {
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                console.log('Cleaned up auth user after profile creation failed');
            } catch (cleanupError) {
                console.error('Failed to cleanup auth user:', cleanupError);
            }
            throw new Error('Failed to create user profile: ' + profileError.message);
        }

        console.log('Profile created successfully:', profileData);

        // Store the email in session storage for verification page
        sessionStorage.setItem('pendingVerificationEmail', email);

        return {
            success: true,
            message: 'Registration successful! Please check your email to verify your account.'
        };
    } catch (error) {
        console.error('Registration error:', error);
        return {
            success: false,
            message: error.message || 'Failed to create account'
        };
    }
}

/**
 * Resends verification email
 * @param {string} email - User's email
 * @returns {Promise<Object>} Result of the operation
 */
export const resendVerificationEmail = async (email) => {
    try {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo: VERIFY_EMAIL_URL
            }
        });

        if (error) throw error;

        return {
            success: true,
            message: 'Verification email sent! Please check your email.'
        };
    } catch (error) {
        console.error('Error resending verification:', error);
        return {
            success: false,
            message: error.message || 'Failed to resend verification email'
        };
    }
};

/**
 * Completes the registration process after email verification
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Result of the operation
 */
export const completeRegistration = async (userId) => {
    try {
        // Update email verification status
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ email_verified: true })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Initialize user stats
        const { error: statsError } = await supabase
            .from('user_stats')
            .upsert([{ user_id: userId }]);

        if (statsError) throw statsError;

        return {
            success: true,
            message: 'Registration completed successfully!'
        };
    } catch (error) {
        console.error('Error completing registration:', error);
        return {
            success: false,
            message: error.message || 'Failed to complete registration'
        };
    }
};

/**
 * Sign in with Google OAuth
 * @returns {Promise<Object>} OAuth result
 */
export const signInWithGoogle = async () => {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${SITE_URL}/html/auth/callback.html`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });    
        
        if (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }

        // Start OAuth flow
        if (data?.url) {
            sessionStorage.setItem('oauth_start_time', Date.now().toString());
            window.location.href = data.url;
            return { data, error: null };
        } else {
            throw new Error('Failed to start Google sign-in process');
        }
    } catch (error) {
        console.error('Google sign-in error:', error);
        return { data: null, error };
    }
};

/**
 * Reset password email flow
 * @param {string} email - User's email
 * @returns {Promise<Object>} Reset password result
 */
export const resetPassword = async (email) => {
    try {
        const timestamp = Date.now();
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${SITE_URL}/html/auth/resetPassword.html?t=${timestamp}`
        });

        if (error) throw error;

        return { 
            data, 
            error: null,
            message: 'Password reset link sent! Link expires in 5 minutes.' 
        };
    } catch (error) {
        return { 
            data: null, 
            error,
            message: error.message || 'Failed to send reset link' 
        };
    }
};

/**
 * Validate reset password token
 * @param {string} token - Reset token to validate
 * @returns {Promise<Object>} Validation result
 */
export const validateResetToken = async (token) => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error) throw error;
        
        return { isValid: true, error: null };
    } catch (error) {
        console.error('Token validation error:', error);
        return { 
            isValid: false, 
            error: error.message || 'Invalid or expired reset link.'
        };
    }
};

/**
 * Checks and cleans up unverified accounts
 * @param {string} email - The email to check
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanupUnverifiedAccount(email) {
    try {
        // Get the unverified user using admin client
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, email_verified')
            .eq('email', email)
            .maybeSingle();

        if (profile && !profile.email_verified) {
            // User exists but is not verified - clean up the account
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
            
            if (deleteError) {
                console.error('Error deleting unverified user:', deleteError);
                return { success: false, message: 'Failed to clean up old account' };
            }

            // Wait for deletion to propagate
            await new Promise(resolve => setTimeout(resolve, 2000));
            return { success: true };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in cleanupUnverifiedAccount:', error);
        return { success: false, message: 'Error checking account status' };
    }
}

import { supabase } from '../config/supabase.js';
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

/**
 * Registers a new user
 * @param {Object} params - Registration parameters
 * @param {string} params.email - User's email
 * @param {string} params.password - User's password
 * @param {string} params.username - User's username
 * @returns {Promise<Object>} Registration result
 */
export const registerUser = async ({ email, password, username }) => {
    try {
        console.log('Starting registration process for:', { email, username });
        
        // Local validations
        const usernameCheck = validateUsername(username);
        const emailCheck = validateEmail(email);
        const passwordCheck = validatePassword(password);

        if (!usernameCheck.isValid) return { success: false, message: usernameCheck.message };
        if (!emailCheck.isValid) return { success: false, message: emailCheck.message };
        if (!passwordCheck.isValid) return { success: false, message: passwordCheck.message };

        // Check username availability one last time
        const { isAvailable, message: availabilityMessage } = await checkUsernameAvailability(username);
        if (!isAvailable) {
            return { success: false, message: availabilityMessage };
        }

        console.log('All validations passed, creating user...');

        // Create auth user with minimal metadata
        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: VERIFY_EMAIL_URL
            }
        });

        if (signUpError) {
            console.error('Auth signup error:', {
                code: signUpError.code,
                message: signUpError.message,
                details: signUpError.details
            });
            return { 
                success: false, 
                message: 'Account creation failed. Please try again.',
                error: signUpError
            };
        }

        if (!data?.user?.id) {
            throw new Error('No user ID returned from signup');
        }

        // Create profile separately
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: data.user.id,
                username,
                email,
                created_at: new Date().toISOString()
            }]);

        if (profileError) {
            console.error('Profile creation error:', profileError);
            // Try to cleanup auth user
            await supabase.auth.admin.deleteUser(data.user.id);
            return {
                success: false,
                message: 'Failed to create user profile. Please try again.'
            };
        }

        console.log('User registered successfully:', {
            userId: data.user.id,
            username
        });

        sessionStorage.setItem('pendingVerificationEmail', email);
        return {
            success: true,
            data,
            message: 'Registration successful! Please check your email.'
        };
    } catch (error) {
        console.error('Registration error:', {
            name: error.name,
            message: error.message,
            code: error.code,
            details: error.details
        });

        return {
            success: false,
            message: 'Registration failed. Please try again later.',
            error: {
                code: error.code,
                message: error.message,
                details: error.details
            }
        };
    }
};

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

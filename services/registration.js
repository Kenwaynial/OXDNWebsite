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
        const { data: existingUsers, error } = await supabase
            .from('profiles')
            .select('username')
            .ilike('username', username)
            .limit(1);

        if (error) {
            console.error('Username check error:', error);
            throw error;
        }

        return {
            isAvailable: !existingUsers?.length,
            message: existingUsers?.length ? 'Username is already taken' : 'Username is available'
        };
    } catch (error) {
        console.error('Username availability check failed:', error);
        return {
            isAvailable: false,
            message: 'Error checking username availability'
        };
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
        }

        // Check availability
        const { isAvailable: isEmailAvailable } = await checkEmailAvailability(email);
        if (!isEmailAvailable) {
            return {
                success: false,
                message: 'This email is already registered. Please use a different email or try logging in.'
            };
        }

        const { isAvailable: isUsernameAvailable } = await checkUsernameAvailability(username);
        if (!isUsernameAvailable) {
            return {
                success: false,
                message: 'This username is already taken. Please choose a different username.'
            };
        }

        // Store email in sessionStorage for verification page
        sessionStorage.setItem('pendingVerificationEmail', email);

        // Register user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    email,
                    avatar_url: null,
                    role: 'user'
                },
                emailRedirectTo: VERIFY_EMAIL_URL
            }
        });

        if (error) {
            console.error('Registration error:', error);
            if (error.message.includes('For security purposes')) {
                return {
                    success: false,
                    message: 'Please wait a moment before trying again.'
                };
            }
            throw error;
        }

        // Wait for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            success: true,
            data,
            message: 'Registration successful! Please check your email to verify your account.'
        };
    } catch (error) {
        console.error('Registration failed:', error);
        return {
            success: false,
            message: error.message || 'An error occurred during registration. Please try again.'
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

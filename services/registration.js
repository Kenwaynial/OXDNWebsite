import { supabase } from '../config/supabase.js';
import { VERIFY_EMAIL_URL } from '../config/supabase.js';

// Debug the imports immediately
console.log('🔧 DEBUG: Registration.js loaded');
console.log('🔧 DEBUG: Supabase client imported:', !!supabase);
console.log('🔧 DEBUG: VERIFY_EMAIL_URL imported:', VERIFY_EMAIL_URL);

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
    return { isValid: true };
};

/**
 * Register a new user - Ultra minimal approach
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} username - User's username
 * @returns {Promise<Object>} Registration result
 */
export async function register(email, password, username) {
    try {
        console.log('🚀 DEBUG: Starting MINIMAL registration process');
        console.log('🚀 DEBUG: Input parameters:', { 
            email: email, 
            username: username, 
            passwordLength: password?.length || 0 
        });
        
        // Basic validation only
        console.log('🔍 DEBUG: Starting validation...');
        if (!email || !email.includes('@')) {
            console.log('❌ DEBUG: Email validation failed');
            return { success: false, message: 'Please enter a valid email address' };
        }
        console.log('✅ DEBUG: Email validation passed');
        
        if (!password || password.length < 6) {
            console.log('❌ DEBUG: Password validation failed');
            return { success: false, message: 'Password must be at least 6 characters long' };
        }
        console.log('✅ DEBUG: Password validation passed');
        
        if (!username || username.length < 3) {
            console.log('❌ DEBUG: Username validation failed');
            return { success: false, message: 'Username must be at least 3 characters long' };
        }
        console.log('✅ DEBUG: Username validation passed');

        console.log('🔧 DEBUG: Validation complete, preparing Supabase signup...');
        console.log('🔧 DEBUG: Supabase client status:', !!supabase);
        console.log('🔧 DEBUG: Supabase auth status:', !!supabase?.auth);

        // Create auth user with ABSOLUTE MINIMUM configuration
        console.log('📡 DEBUG: Calling supabase.auth.signUp...');
        const signUpPayload = {
            email: email,
            password: password
            // NO options, NO metadata, NO redirects - just the bare minimum
        };
        console.log('📡 DEBUG: SignUp payload:', signUpPayload);

        const { data: authData, error: authError } = await supabase.auth.signUp(signUpPayload);

        console.log('📡 DEBUG: Supabase signUp response received');
        console.log('📡 DEBUG: Auth data:', authData);
        console.log('📡 DEBUG: Auth error:', authError);

        if (authError) {
            console.error('❌ DEBUG: Auth signup error details:', {
                message: authError.message,
                status: authError.status,
                code: authError.code,
                details: authError
            });
            return { success: false, message: authError.message };
        }

        if (!authData?.user) {
            console.error('❌ DEBUG: No user data returned from signup');
            console.log('❌ DEBUG: Full authData:', authData);
            return { success: false, message: 'Registration failed - no user data returned' };
        }

        console.log('✅ DEBUG: Auth user created successfully!');
        console.log('✅ DEBUG: User ID:', authData.user.id);
        console.log('✅ DEBUG: User email:', authData.user.email);
        console.log('✅ DEBUG: User email confirmed:', authData.user.email_confirmed_at);

        // Store data locally for now
        console.log('💾 DEBUG: Storing registration data in sessionStorage...');
        sessionStorage.setItem('registrationSuccess', 'true');
        sessionStorage.setItem('pendingUsername', username);
        sessionStorage.setItem('pendingUserId', authData.user.id);
        sessionStorage.setItem('pendingEmail', email);
        console.log('💾 DEBUG: SessionStorage data saved');

        console.log('🎉 DEBUG: Registration process completed successfully!');
        return {
            success: true,
            message: 'Registration successful! Please check your email to verify your account.',
            userId: authData.user.id
        };

    } catch (error) {
        console.error('💥 DEBUG: Unexpected error in registration function:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            fullError: error
        });
        return {
            success: false,
            message: error.message || 'Registration failed'
        };
    }
}

/**
 * Resends verification email to user
 * @param {string} email - User's email address
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
            message: 'Verification email sent! Please check your inbox.'
        };
    } catch (error) {
        console.error('Error sending verification:', error);
        return {
            success: false,
            message: error.message || 'Failed to send verification email'
        };
    }
};

/**
 * Create user profile after email verification - Disabled for now
 * @param {string} userId - User's ID
 * @param {string} username - User's username
 * @returns {Promise<Object>} Result of the operation
 */
export const createUserProfile = async (userId, username) => {
    try {
        // Disabled for now to avoid database conflicts
        console.log('Profile creation disabled during testing:', { userId, username });
        return {
            success: true,
            message: 'Profile creation skipped during testing'
        };
    } catch (error) {
        console.error('Error creating profile:', error);
        return {
            success: false,
            message: error.message || 'Failed to create profile'
        };
    }
};

/**
 * Check if username is available - Simplified for testing
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} True if available
 */
export const isUsernameAvailable = async (username) => {
    try {
        // For now, just return true to avoid database conflicts
        // We'll implement real checking after auth signup works
        console.log('Checking username availability (simplified):', username);
        return true;
    } catch (error) {
        console.error('Error checking username:', error);
        return true; // Default to available to avoid blocking registration
    }
};

/**
 * Real-time username validation with availability check
 * @param {string} username - Username to validate
 * @returns {Promise<Object>} Validation result with availability
 */
export const validateUsernameRealTime = async (username) => {
    // First check format
    const formatValidation = validateUsername(username);
    if (!formatValidation.isValid) {
        return formatValidation;
    }

    // Then check availability
    const isAvailable = await isUsernameAvailable(username);
    
    return {
        isValid: isAvailable,
        message: isAvailable ? 'Username is available!' : 'Username is already taken'
    };
};

/**
 * Real-time email validation
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export const validateEmailRealTime = (email) => {
    return validateEmail(email);
};

/**
 * Real-time password strength checker
 * @param {string} password - Password to check
 * @returns {Object} Password strength result
 */
export const checkPasswordStrength = (password) => {
    if (!password) {
        return { strength: 'none', message: 'Password is required', color: '#ff4444' };
    }

    let score = 0;
    let feedback = [];

    // Length check
    if (password.length >= 8) {
        score += 2;
    } else if (password.length >= 6) {
        score += 1;
        feedback.push('Consider making it longer');
    } else {
        feedback.push('Too short (minimum 6 characters)');
    }

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    // Determine strength
    let strength, message, color;
    
    if (score < 3) {
        strength = 'weak';
        message = 'Weak password';
        color = '#ff4444';
    } else if (score < 5) {
        strength = 'medium';
        message = 'Good password';
        color = '#ffaa00';
    } else {
        strength = 'strong';
        message = 'Strong password';
        color = '#44ff44';
    }

    if (feedback.length > 0) {
        message += ' - ' + feedback.join(', ');
    }

    return { strength, message, color, isValid: score >= 2 };
};

/**
 * Get user registration status - Simplified
 * @param {string} email - User's email
 * @returns {Promise<Object>} Registration status
 */
export const getUserRegistrationStatus = async (email) => {
    try {
        // For now, simplified status check without admin access
        console.log('Checking registration status (simplified):', email);
        return { exists: false, verified: false };
    } catch (error) {
        console.error('Error checking registration status:', error);
        return { exists: false, verified: false, error: error.message };
    }
};

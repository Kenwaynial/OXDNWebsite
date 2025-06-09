/**
 * Ultra-simple registration that bypasses all database complexities
 * This approach creates ONLY the auth user and stores username in localStorage
 */

import { supabase } from '../config/supabase.js';

/**
 * Simple email validation
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Simple password validation
 */
const validatePassword = (password) => {
    return password && password.length >= 6;
};

/**
 * Simple username validation
 */
const validateUsername = (username) => {
    return username && username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
};

/**
 * Ultra-simple registration - ONLY creates auth user
 * No database tables, no triggers, no conflicts
 */
export async function simpleRegister(email, password, username) {
    try {
        console.log('Starting simple registration...');

        // Basic validation
        if (!validateEmail(email)) {
            return { success: false, message: 'Please enter a valid email address' };
        }
        
        if (!validatePassword(password)) {
            return { success: false, message: 'Password must be at least 6 characters long' };
        }
        
        if (!validateUsername(username)) {
            return { success: false, message: 'Username must be at least 3 characters and contain only letters, numbers, and underscores' };
        }

        console.log('Validation passed, creating auth user...');

        // Create ONLY the auth user - absolutely minimal
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (authError) {
            console.error('Auth error:', authError);
            
            if (authError.message.includes('already registered')) {
                return {
                    success: false,
                    message: 'This email is already registered. Please check your email for verification or try logging in.',
                    needsVerification: true,
                    email: email
                };
            }
            
            return { success: false, message: authError.message };
        }

        if (!authData?.user) {
            return { success: false, message: 'Registration failed - no user data returned' };
        }

        console.log('Auth user created successfully!', authData.user.id);

        // Store username temporarily in localStorage
        // We'll move this to database later once auth works
        localStorage.setItem('pendingUsername', username);
        localStorage.setItem('pendingUserId', authData.user.id);

        return {
            success: true,
            message: 'Registration successful! Please check your email to verify your account.',
            userId: authData.user.id
        };

    } catch (error) {
        console.error('Simple registration error:', error);
        return {
            success: false,
            message: error.message || 'Registration failed'
        };
    }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email) {
    try {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { 
            success: true, 
            message: 'Verification email sent! Please check your email.' 
        };
    } catch (error) {
        console.error('Resend error:', error);
        return { 
            success: false, 
            message: error.message || 'Failed to resend verification email' 
        };
    }
}

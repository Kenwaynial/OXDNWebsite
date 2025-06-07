import { supabase, VERIFY_EMAIL_URL } from '../config/supabase.js';

// Simple sign in function
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error

    // Update user activity (increments login count and sets status to online)
    if (data?.user) {
      await supabase.rpc('increment_total_logins', { user_id: data.user.id })
    }
    
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Simple sign out function
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// Get current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return { user, error: null }
  } catch (error) {
    return { user: null, error }
  }
}

/**
 * Session management functions
 * These functions deal with active sessions and user state,
 * not user registration, so they stay in auth.js
 */

export const signUp = async (email, password, username) => {
  try {
    // Validate username and email format according to schema constraints
    if (!username || username.length < 3 || username.length > 30) {
      return { 
        success: false, 
        message: 'Username must be between 3 and 30 characters' 
      };
    }

    if (!email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
      return {
        success: false,
        message: 'Invalid email format'
      };
    }

    // Check both username and email availability using proper SQL syntax
    const { data: existingUsers, error: checkError } = await supabase
      .from('profiles')
      .select('username, email')
      .or(`username.eq.${username},email.eq.${email}`)
      .limit(1);

    if (checkError) throw checkError;

    if (existingUsers?.length > 0) {
      const existing = existingUsers[0];
      if (existing.username === username) {
        return { success: false, message: 'Username is already taken' };
      }
      if (existing.email === email) {
        return { success: false, message: 'Email is already registered' };
      }
    }    // Proceed with signup - auth.users will be created first
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username, // Only pass essential fields
          email,
          role: 'user',
          email_verified: false
        },
        emailRedirectTo: VERIFY_EMAIL_URL
      }
    });

    if (signUpError) throw signUpError;

    // Store email for verification page
    sessionStorage.setItem('pendingVerificationEmail', email);

    return { 
      success: true,
      data,
      message: 'Registration successful! Please check your email to verify your account.'
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: error.message || 'An error occurred during registration'
    };
  }
}

/**
 * Resends verification email to user
 * @param {string} email - User's email address
 * @returns {Promise<Object>} Result of the operation
 */
export const resendVerification = async (email) => {
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
 * Checks user's email verification status
 * @returns {Promise<Object>} Verification status
 */
export const checkVerificationStatus = async () => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (!session?.user) {
            return {
                success: false,
                message: 'No active session found'
            };
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email_verified')
            .eq('id', session.user.id)
            .single();

        if (profileError) throw profileError;

        return {
            success: true,
            verified: session.user.email_confirmed_at && profile?.email_verified,
            message: session.user.email_confirmed_at ? 'Email verified!' : 'Email not verified'
        };
    } catch (error) {
        console.error('Error checking verification:', error);
        return {
            success: false,
            message: error.message || 'Failed to check verification status'
        };
    }
}

// Google Sign In function
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/html/auth/callback.html`,
      },
    });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

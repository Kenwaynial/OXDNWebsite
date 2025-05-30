import { supabase } from '../config/supabase.js';

// Constants
const SITE_URL = 'https://oxdn.vercel.app';
const VERIFY_EMAIL_URL = `${SITE_URL}/html/verifyEmail.html`;

// Export all needed items in one place
export { 
    supabase,
    SITE_URL, 
    VERIFY_EMAIL_URL 
};

// Simple sign up function
export const signUp = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: VERIFY_EMAIL_URL,
        data: {
          site_url: SITE_URL
        }
      }
    })
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Simple sign in function
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    
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

// Resend verification email
export const resendVerification = async (email) => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: VERIFY_EMAIL_URL,
        data: {
          site_url: SITE_URL
        }
      }
    })
    
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error }
  }
}

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

    // If we get here, the OAuth flow has started
    if (data?.url) {
      // Redirect to Google's OAuth page
      window.location.href = data.url;
      return { data, error: null };
    } else {
      throw new Error('Failed to start Google sign-in process');
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    return { data: null, error };
  }
}

export const registerWithEmail = async (email, password, username) => {
  try {
    console.log('Starting registration process for:', { email, username });

    // First check if email already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)

    if (checkError) {
      console.error('Email check error:', checkError)
      return {
        success: false,
        message: 'Error checking email availability. Please try again.'
      }
    }

    if (existingUsers && existingUsers.length > 0) {
      console.log('Email already exists:', email);
      return {
        success: false,
        message: 'This email is already registered. Please use a different email or try logging in.'
      }
    }

    // Check if username is already taken
    const { data: existingUsernames, error: usernameError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)

    if (usernameError) {
      console.error('Username check error:', usernameError)
      return {
        success: false,
        message: 'Error checking username availability. Please try again.'
      }
    }

    if (existingUsernames && existingUsernames.length > 0) {
      console.log('Username already taken:', username);
      return {
        success: false,
        message: 'This username is already taken. Please choose a different username.'
      }
    }

    console.log('Email and username available, proceeding with signup');

    // Store email in sessionStorage for verification page
    sessionStorage.setItem('pendingVerificationEmail', email)

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          site_url: SITE_URL
        },
        emailRedirectTo: VERIFY_EMAIL_URL
      }
    })

    if (error) {
      console.error('Signup error:', error);
      if (error.message.includes('For security purposes')) {
        return {
          success: false,
          message: 'Please wait a moment before trying again.'
        }
      }
      if (error.message.includes('already registered')) {
        return {
          success: false,
          message: 'This email is already registered. Please use a different email or try logging in.'
        }
      }
      if (error.message.includes('Database error')) {
        console.error('Database error details:', error);
        return {
          success: false,
          message: 'Error creating account. Please try again or contact support.'
        }
      }
      throw error
    }

    console.log('User created successfully');

    return {
      success: true,
      message: 'Registration successful! Please check your email to verify your account.'
    }
  } catch (error) {
    console.error('Registration error:', error)
    return {
      success: false,
      message: error.message || 'An error occurred during registration. Please try again.'
    }
  }
}

export const resetPassword = async (email) => {
  try {
    const options = {
      redirectTo: `${SITE_URL}/html/auth/resetPassword.html`,
      data: {
        timestamp: new Date().getTime()
      }
    };

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, options);

    if (error) {
      console.error('Password reset request error:', error);
      throw error;
    }

    return { 
      data, 
      error: null,
      message: 'Password reset link sent! Please check your email.' 
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return { 
      data: null, 
      error,
      message: error.message || 'Failed to send reset link. Please try again.' 
    };
  }
}

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
}
import { supabase, VERIFY_EMAIL_URL, SITE_URL } from '../config/supabase.js'

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
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: VERIFY_EMAIL_URL
    }
  })
  return { data, error }
}

export const registerWithEmail = async (email, password, username) => {
  try {
    // Store email in sessionStorage for verification page
    sessionStorage.setItem('pendingVerificationEmail', email);

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
      if (error.message.includes('For security purposes')) {
        throw new Error('Please wait a moment before trying again.')
      }
      throw error
    }

    // Create profile using the stored procedure
    if (data.user) {
      const { error: profileError } = await supabase.rpc('create_profile_for_user', {
        user_email: email,
        user_id: data.user.id,
        user_metadata: {
          username: username,
          site_url: SITE_URL
        }
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        throw new Error('Failed to create user profile. Please try again.')
      }
    }

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
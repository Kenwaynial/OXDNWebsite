import { supabase } from '../config/supabase.js'

export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
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
          display_name: username // Set display name same as username initially
        },
        emailRedirectTo: 'https://oxdn.vercel.app/html/verifyEmail.html'
      }
    })

    if (error) {
      if (error.message.includes('For security purposes')) {
        throw new Error('Please wait a moment before trying again.')
      }
      if (error.message.includes('already registered')) {
        throw new Error('This email is already registered. Please try logging in or use a different email.')
      }
      throw error
    }

    // Create profile using the new handle_registration function
    if (data.user) {
      const { error: profileError } = await supabase.rpc('handle_registration', {
        user_id: data.user.id,
        user_email: email,
        user_metadata: { 
          username: username,
          display_name: username
        }
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        if (profileError.code === '23505') {
          throw new Error('This email is already registered. Please try logging in or use a different email.')
        }
        throw new Error('Username is already taken. Please try a different username.')
      }
    }

    return {
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data
    }
  } catch (error) {
    console.error('Registration error:', error)
    return {
      success: false,
      message: error.message || 'An error occurred during registration. Please try again.'
    }
  }
}

export const resendVerificationEmail = async (email) => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email
    })

    if (error) throw error

    return {
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    }
  } catch (error) {
    console.error('Resend verification error:', error)
    return {
      success: false,
      message: error.message || 'Failed to resend verification email. Please try again.'
    }
  }
} 
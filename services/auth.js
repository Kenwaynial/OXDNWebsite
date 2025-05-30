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
    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        },
        emailRedirectTo: `${window.location.origin}/html/verifyEmail.html`
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
        user_id: data.user.id,
        user_email: email,
        user_metadata: { username }
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // If profile creation fails, we should delete the user
        await supabase.auth.admin.deleteUser(data.user.id)
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
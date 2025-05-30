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
    // First, sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    })

    if (error) throw error

    // Create a profile for the user
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            username: username,
            email: email,
            role: 'member',
            created_at: new Date().toISOString()
          }
        ])

      if (profileError) throw profileError
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
      message: error.message
    }
  }
} 
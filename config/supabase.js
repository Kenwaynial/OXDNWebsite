import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = 'https://ncehdvoeausqrzjohgll.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZWhkdm9lYXVzcXJ6am9oZ2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NDYwODIsImV4cCI6MjA2NDEyMjA4Mn0.DkV7MvbzShMu8kps7bzad25wVjMH-N6l-MHagaKfvF0';

// Site URL configuration
const SITE_URL = 'https://oxdn.vercel.app';
const VERIFY_EMAIL_URL = `${SITE_URL}/html/verifyEmail.html`;
const RESET_PASSWORD_URL = `${SITE_URL}/html/auth/resetPassword.html`;
const AUTH_CALLBACK_URL = `${SITE_URL}/auth/callback`;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    defaultOptions: {
      emailRedirectTo: VERIFY_EMAIL_URL
    }
  }
})

// Export URLs for use in other files
export { 
  SITE_URL, 
  VERIFY_EMAIL_URL,
  RESET_PASSWORD_URL,
  AUTH_CALLBACK_URL
};

// Auth helpers
export const signUp = async (email, password, username) => {  try {
    // First check if username already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username);

    if (checkError) {
      console.error('Username check error:', checkError);
      throw new Error('Error checking username availability');
    }

    if (existingUsers && existingUsers.length > 0) {
      throw new Error('Username already taken');
    }

    // Proceed with signup if username is available
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: VERIFY_EMAIL_URL
      }
    });

    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Signup error:', error);
    return { data: null, error };
  }
}

export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Sign in error details:', error);
      throw error;
    }

    // If sign in successful, update the user activity
    if (data?.user) {
      const { error: rpcError } = await supabase.rpc('increment_total_logins', {
        user_id: data.user.id
      });

      if (rpcError) {
        console.error('Failed to increment login count:', rpcError);
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { data: null, error };
  }
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_URL}/html/auth/callback.html`
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

// Profile helpers
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  return { data, error }
}

// Online status helpers
export const updateOnlineStatus = async (userId, status, currentGame = null) => {
  const { data, error } = await supabase
    .from('online_status')
    .upsert({ 
      user_id: userId, 
      status: status,
      current_game: currentGame,
      last_seen: new Date().toISOString()
    })
  return { data, error }
}

export const getOnlineUsers = async () => {
  const { data, error } = await supabase
    .from('online_status')
    .select(`
      user_id,
      status,
      current_game,
      last_seen,
      profiles:user_id (
        username,
        avatar_url,
        role
      )
    `)
    .eq('status', 'online')
  return { data, error }
}

// User stats helpers
export const getUserStats = async (userId) => {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

export const updateUserStats = async (userId, updates) => {
  const { data, error } = await supabase
    .from('user_stats')
    .update(updates)
    .eq('user_id', userId)
  return { data, error }
}

export const incrementGamesPlayed = async (userId) => {
  const { data, error } = await supabase.rpc('increment_games_played', {
    user_id: userId
  })
  return { data, error }
}

export const incrementTournamentsWon = async (userId) => {
  const { data, error } = await supabase.rpc('increment_tournaments_won', {
    user_id: userId
  })
  return { data, error }
}

// Real-time subscriptions
export const subscribeToOnlineStatus = (callback) => {
  return supabase
    .channel('online_status')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'online_status' 
      }, 
      callback
    )
    .subscribe()
}

export const subscribeToUserStats = (userId, callback) => {
  return supabase
    .channel(`user_stats:${userId}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'user_stats',
        filter: `user_id=eq.${userId}`
      }, 
      callback
    )
    .subscribe()
}

// Add password reset helpers
export const resetPassword = async (email) => {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: RESET_PASSWORD_URL,
        captchaToken: undefined
      }
    );

    if (error) throw error;

    return { 
      success: true,
      message: 'Password reset link sent! Please check your email.' 
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return { 
      success: false,
      message: error.message || 'Failed to send reset link' 
    };
  }
}
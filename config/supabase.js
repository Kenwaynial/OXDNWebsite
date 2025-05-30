import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Site URL configuration
const SITE_URL = 'https://oxdn.vercel.app';
const VERIFY_EMAIL_URL = `${SITE_URL}/html/verifyEmail.html`;

// Determine if we're in development mode
const isDevMode = typeof window !== 'undefined' && 
                 (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Create Supabase client with explicit site URL
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    redirectTo: VERIFY_EMAIL_URL,
    // Force the site URL to be used in email links
    site: SITE_URL,
    // Additional options to ensure production URL is used
    cookieOptions: {
      domain: '.vercel.app',
      path: '/',
      sameSite: 'lax'
    }
  },
  global: {
    headers: {
      'x-site-url': SITE_URL
    }
  }
})

// Export the URLs for use in other files
export { SITE_URL, VERIFY_EMAIL_URL, isDevMode };

// Auth helpers
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
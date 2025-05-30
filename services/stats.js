import { supabase } from '../config/supabase.js'

export const getUserStats = async (userId) => {
  // First try to get existing stats
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  // If no stats exist, create them
  if (error?.code === 'PGRST116') {
    const { data: newStats, error: createError } = await supabase
      .from('user_stats')
      .insert([
        {
          user_id: userId,
          last_activity: new Date().toISOString(),
          total_logins: 1
        }
      ])
      .select()
      .single()

    if (createError) {
      return { data: null, error: createError }
    }
    return { data: newStats, error: null }
  }

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
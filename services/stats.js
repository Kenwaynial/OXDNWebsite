import { supabase } from '../config/supabase.js'

export const getUserStats = async (userId) => {
  try {
    // First try to get existing stats
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // If no stats exist or there's an error, create them
    if (!data || error) {
      console.log('Creating new user stats for:', userId);
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
        console.error('Error creating user stats:', createError);
        return { data: null, error: createError }
      }
      return { data: newStats, error: null }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return { data: null, error }
  }
}

export const updateUserStats = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single()
    return { data, error }
  } catch (error) {
    console.error('Error in updateUserStats:', error);
    return { data: null, error }
  }
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
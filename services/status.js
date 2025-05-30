import { supabase } from '../config/supabase.js'

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
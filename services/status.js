import { supabase } from '../config/supabase.js'

export const updateOnlineStatus = async (userId, status) => {
  try {
    // First try to update existing status
    const { error: updateError } = await supabase
      .from('online_status')
      .update({ 
        status,
        last_seen: new Date().toISOString()
      })
      .eq('user_id', userId)

    // If no record exists, create one
    if (updateError?.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('online_status')
        .insert([
          {
            user_id: userId,
            status,
            last_seen: new Date().toISOString()
          }
        ])

      if (insertError) throw insertError
    } else if (updateError) {
      throw updateError
    }

    return { error: null }
  } catch (error) {
    console.error('Error updating online status:', error)
    return { error }
  }
}

export const getOnlineStatus = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('online_status')
      .select('status, last_seen')
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting online status:', error)
    return { data: null, error }
  }
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
    .channel('online_status_changes')
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
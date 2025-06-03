import { supabase } from '../config/supabase.js'

export const updateOnlineStatus = async (userId, status) => {
  try {
    if (!['online', 'offline', 'away'].includes(status)) {
      throw new Error('Invalid status. Must be one of: online, offline, away')
    }

    // Upsert the status - this handles both insert and update in one operation
    const { error } = await supabase
      .from('online_status')
      .upsert({
        user_id: userId,
        status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })

    if (error) throw error
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
  const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
  const staleTimestamp = new Date(Date.now() - STALE_THRESHOLD).toISOString();
  
  const { data, error } = await supabase
    .from('online_status')
    .select(`
      user_id,
      status,
      last_seen,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .or(`status.eq.online,and(status.eq.away,last_seen.gte.${staleTimestamp})`)
    .order('last_seen', { ascending: false })

  // Filter out any users whose status is stale
  const activeUsers = data?.filter(user => {
    const lastSeen = new Date(user.last_seen).getTime();
    return Date.now() - lastSeen < STALE_THRESHOLD;
  }) || [];

  return { data: activeUsers, error }
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

export const cleanupStaleStatuses = async () => {
  try {
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    const staleTimestamp = new Date(Date.now() - STALE_THRESHOLD).toISOString();

    const { error } = await supabase
      .from('online_status')
      .update({ 
        status: 'offline',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'online')
      .lt('last_seen', staleTimestamp)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error cleaning up stale statuses:', error)
    return { error }
  }
}
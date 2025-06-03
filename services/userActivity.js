import { supabase } from '../config/supabase.js'

export const updateUserStatus = async (userId, status) => {
  try {
    if (!['online', 'offline', 'away'].includes(status)) {
      throw new Error('Invalid status. Must be one of: online, offline, away')
    }

    const { data, error } = await supabase
      .from('user_activity')
      .update({
        status,
        last_seen: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating user status:', error)
    return { error }
  }
}

export const getUserActivity = async (userId) => {  try {
    if (!userId) {
      throw new Error('User ID is required to fetch activity')
    }

    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found, create one with default values
        const { data: newActivity, error: createError } = await supabase
          .from('user_activity')
          .insert([{
            user_id: userId,
            status: 'offline',
            last_seen: new Date().toISOString(),
            total_logins: 0
          }])
          .select()
          .single()

        if (createError) throw createError
        return { data: newActivity, error: null }
      }
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error getting user activity:', error)
    return { data: null, error }
  }
}

export const getOnlineUsers = async () => {
  const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
  const staleTimestamp = new Date(Date.now() - STALE_THRESHOLD).toISOString();
  
  const { data, error } = await supabase
    .from('user_activity')
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

  // Filter out stale users
  const activeUsers = data?.filter(user => {
    const lastSeen = new Date(user.last_seen).getTime();
    return Date.now() - lastSeen < STALE_THRESHOLD;
  }) || [];

  return { data: activeUsers, error }
}

export const incrementTotalLogins = async (userId) => {
  try {
    const { data, error } = await supabase.rpc('increment_total_logins', {
      user_id: userId
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error incrementing total logins:', error)
    return { data: null, error }
  }
}

export const cleanupStaleStatuses = async () => {
  try {
    const ONLINE_STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes for online users
    const AWAY_STALE_THRESHOLD = 30 * 60 * 1000;  // 30 minutes for away users
    const now = Date.now();
    
    const onlineStaleTimestamp = new Date(now - ONLINE_STALE_THRESHOLD).toISOString();
    const awayStaleTimestamp = new Date(now - AWAY_STALE_THRESHOLD).toISOString();

    // First update stale online users to away
    const { error: onlineError } = await supabase
      .from('user_activity')
      .update({ 
        status: 'away',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'online')
      .lt('last_seen', onlineStaleTimestamp);

    if (onlineError) throw onlineError;

    // Then update stale away users to offline
    const { error: awayError } = await supabase
      .from('user_activity')
      .update({ 
        status: 'offline',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'away')
      .lt('last_seen', awayStaleTimestamp);

    if (awayError) throw awayError;
    
    return { error: null }
  } catch (error) {
    console.error('Error cleaning up stale statuses:', error)
    return { error }
  }
}

export const subscribeToUserActivity = (userId, callback) => {
  if (!userId) {
    console.error('User ID is required for activity subscription');
    return null;
  }

  let retryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  const setupSubscription = () => {
    const channel = supabase
      .channel(`user_activity:${userId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_activity',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          // Add timestamp to the payload
          payload.received_at = Date.now();
          callback(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIPTION_ERROR' && retryCount < MAX_RETRIES) {
          retryCount++;
          console.warn(`Subscription failed, retry ${retryCount}/${MAX_RETRIES} in ${RETRY_DELAY}ms`);
          setTimeout(() => {
            channel.unsubscribe();
            setupSubscription();
          }, RETRY_DELAY);
        }
      });

    return channel;
  };

  return setupSubscription();
}

export const getUserActivities = async (userIds) => {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('User IDs array is required to fetch activities')
    }

    const { data, error } = await supabase
      .from('user_activity')
      .select(`
        *,
        profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .in('user_id', userIds)

    if (error) throw error

    // Transform the data to include computed fields
    const enrichedData = data.map(activity => ({
      ...activity,
      isStale: Date.now() - new Date(activity.last_seen).getTime() > 5 * 60 * 1000,
      displayStatus: activity.status === 'online' && 
                    Date.now() - new Date(activity.last_seen).getTime() > 5 * 60 * 1000 
                    ? 'away' 
                    : activity.status
    }));

    return { data: enrichedData, error: null }
  } catch (error) {
    console.error('Error getting user activities:', error)
    return { data: null, error }
  }
}

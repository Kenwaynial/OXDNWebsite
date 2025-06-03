import { supabase } from '../config/supabase.js'

// Update user status (online, offline, away)
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

// Get a user's activity (creates record if not found)
export const getUserActivity = async (userId) => {
  try {
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

// Subscribe to user activity changes (realtime)
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
};

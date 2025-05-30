import { supabase } from '../config/supabase.js'

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

export const updateAvatar = async (userId, avatarUrl) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
  return { data, error }
}

export const updateGamingInfo = async (userId, { discord_id, steam_id, favorite_games }) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      discord_id,
      steam_id,
      favorite_games,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
  return { data, error }
} 
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * The account service. The publishable key is designed to be public (Supabase: "Safe to expose
 * online"). Null until both settings exist, so the app can explain setup instead of breaking.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

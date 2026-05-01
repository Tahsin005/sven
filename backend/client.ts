import { SUPABASE_SECRET_KEY, SUPABASE_URL } from './env'
import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
    return createClient(
        SUPABASE_URL!,
        SUPABASE_SECRET_KEY!
    )
}

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUB_KEY = import.meta.env.VITE_SUPABASE_PUB_KEY

if (!SUPABASE_URL || !SUPABASE_PUB_KEY) {
    throw new Error(
        'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUB_KEY must be set.'
    )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUB_KEY, {
    auth: {
        flowType: 'pkce',
        storage: window.localStorage,
    }
})

export default supabase
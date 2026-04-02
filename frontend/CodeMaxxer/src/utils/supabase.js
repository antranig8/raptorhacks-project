import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUB_KEY = import.meta.env.VITE_SUPABASE_PUB_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_PUB_KEY, {
    auth: {
        flowType: 'pkce',
        storage: window.localStorage,
    }
})

export default supabase
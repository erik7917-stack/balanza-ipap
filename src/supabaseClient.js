import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ipjkvqumejfaojhuyrzc.supabase.co'
const supabaseAnonKey = 'sb_publishable_eOio8o1qMjoTVrSCcH4iGA_tflphLcL'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
import { createClient } from '@supabase/supabase-js'

// Verbindung zur Datenbank (Supabase, Region Frankfurt).
// Adresse und "publishable"-Schlüssel sind öffentlich und dürfen im Code stehen:
// Was gelesen oder geschrieben werden darf, regeln allein die Zugriffsregeln (Row Level Security) in der Datenbank.
// Der geheime "secret"/"service_role"-Schlüssel gehört NIE in diesen Code.
export const SUPABASE_URL = 'https://lmyvdhvuykeiizeeglvc.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rNa58IYdPFfja6r6rb06nw_YUWsRy18'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

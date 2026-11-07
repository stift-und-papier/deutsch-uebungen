import { createClient } from '@supabase/supabase-js'

// Verbindung zur Datenbank (Supabase, Region Frankfurt).
// Adresse und "publishable"-Schlüssel sind öffentlich und dürfen im Code stehen:
// Was gelesen oder geschrieben werden darf, regeln allein die Zugriffsregeln (Row Level Security) in der Datenbank.
// Der geheime "secret"/"service_role"-Schlüssel gehört NIE in diesen Code.
export const SUPABASE_URL = 'https://qefbtxchyqhjfmpkgosm.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EdP9Mb7IVDdC7fe0dORskg_Rb8WW-ms'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

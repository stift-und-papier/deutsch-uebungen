import { useEffect, useState } from 'react'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './lib/supabase'

// Startseite der App.
// In Etappe 0 ist das nur ein Platzhalter, der prüft, ob die Datenbank erreichbar ist.
function App() {
  const [verbindung, setVerbindung] = useState<'pruefe' | 'ok' | 'fehler'>('pruefe')

  useEffect(() => {
    fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } })
      .then((antwort) => setVerbindung(antwort.ok ? 'ok' : 'fehler'))
      .catch(() => setVerbindung('fehler'))
  }, [])

  return (
    <main className="seite">
      <h1>Deutsch üben</h1>
      <p>Die Übungsplattform wird gerade aufgebaut.</p>
      <p>
        Datenbank:{' '}
        {verbindung === 'pruefe' && 'wird geprüft …'}
        {verbindung === 'ok' && '✅ verbunden'}
        {verbindung === 'fehler' && '❌ nicht erreichbar'}
      </p>
    </main>
  )
}

export default App

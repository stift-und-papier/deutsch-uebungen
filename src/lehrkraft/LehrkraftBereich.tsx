import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { supabase } from '../lib/supabase'
import { AufgabeEditor } from './AufgabeEditor'
import { AufgabenListe } from './AufgabenListe'
import { KlasseDetail } from './KlasseDetail'
import { KlassenListe } from './KlassenListe'
import { Kompetenzen } from './Kompetenzen'
import { Linkliste } from './Linkliste'
import { PaketDetail } from './PaketDetail'
import { PaketListe } from './PaketListe'

// Bereich nur für angemeldete Lehrkräfte.
export function LehrkraftBereich({ pfad }: { pfad: string[] }) {
  const [sitzung, setSitzung] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSitzung(data.session))
    const { data } = supabase.auth.onAuthStateChange((_ereignis, neu) => setSitzung(neu))
    return () => data.subscription.unsubscribe()
  }, [])

  if (sitzung === undefined) return <main className="seite"><p>Einen Moment …</p></main>
  if (!sitzung) return <Anmeldung />

  const [bereich = 'klassen', id, unter] = pfad
  // Die Linkliste ist ein Druckblatt und kommt ohne Menü aus.
  if (bereich === 'klassen' && id && unter === 'links') return <Linkliste klasseId={id} />

  return (
    <div className="lehrkraft">
      <nav className="hauptmenue">
        <a href="#/lehrkraft/klassen" aria-current={bereich === 'klassen' ? 'page' : undefined}>
          Klassen
        </a>
        <a href="#/lehrkraft/aufgaben" aria-current={bereich === 'aufgaben' ? 'page' : undefined}>
          Aufgaben
        </a>
        <a href="#/lehrkraft/pakete" aria-current={bereich === 'pakete' ? 'page' : undefined}>
          Aufgabenpakete
        </a>
        <a href="#/lehrkraft/kompetenzen" aria-current={bereich === 'kompetenzen' ? 'page' : undefined}>
          Kompetenzen
        </a>
        <button className="knopf leise abmelden" onClick={() => void supabase.auth.signOut()}>
          Abmelden
        </button>
      </nav>
      <main className="seite breit">
        {bereich === 'klassen' && !id && <KlassenListe />}
        {bereich === 'klassen' && id && <KlasseDetail klasseId={id} />}
        {bereich === 'aufgaben' && !id && <AufgabenListe />}
        {bereich === 'aufgaben' && id && <AufgabeEditor aufgabeId={id === 'neu' ? null : id} />}
        {bereich === 'pakete' && !id && <PaketListe />}
        {bereich === 'pakete' && id && <PaketDetail paketId={id} vorschau={unter === 'vorschau'} />}
        {bereich === 'kompetenzen' && <Kompetenzen />}
      </main>
    </div>
  )
}

function Anmeldung() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)

  return (
    <main className="seite schmal">
      <h1>Anmeldung für Lehrkräfte</h1>
      <form
        className="formular"
        onSubmit={async (e) => {
          e.preventDefault()
          setBeschaeftigt(true)
          const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
          setBeschaeftigt(false)
          if (error) setFehler(fehlerText(error))
        }}
      >
        <label>
          E-Mail-Adresse
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Passwort
          <input
            type="password"
            autoComplete="current-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            required
          />
        </label>
        {fehler && <p className="hinweis-box">{fehler}</p>}
        <button className="knopf haupt" disabled={beschaeftigt}>
          {beschaeftigt ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
      <p className="klein">
        Schüler:innen brauchen keine Anmeldung. Sie öffnen ihren persönlichen Link.
      </p>
    </main>
  )
}

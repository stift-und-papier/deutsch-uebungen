import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { fehlerText } from '../lib/fehler'
import { supabase } from '../lib/supabase'
import { AufgabeEditor } from './AufgabeEditor'
import { AufgabenListe } from './AufgabenListe'
import { KlasseDetail } from './KlasseDetail'
import { EinstellungenSeite } from './EinstellungenSeite'
import { KlassenLernstand } from './KlassenLernstand'
import { KlassenListe } from './KlassenListe'
import { SchuelerLernstand } from './SchuelerLernstand'
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

  if (sitzung === undefined)
    return (
      <div className="abendhimmel">
        <main className="seite schmal">
          <p className="aes-card">Einen Moment …</p>
        </main>
      </div>
    )
  if (!sitzung) return <Anmeldung />

  const [bereich = 'klassen', id, unter] = pfad
  // Die Linkliste ist ein Druckblatt und kommt ohne Menü aus.
  if (bereich === 'klassen' && id && unter === 'links') return <Linkliste klasseId={id} />
  // Ebenso die Druckansicht der Einzelansicht (öffnet direkt den Druckdialog).
  if (bereich === 'schueler' && id && unter === 'drucken')
    return (
      <main className="seite breit">
        <SchuelerLernstand schuelerId={id} drucken />
      </main>
    )

  // Seiten, die schon aus eigenen Karten bestehen (Auswertung, Einzelansicht, Paket-Vorschau)
  const eigeneKarten =
    (bereich === 'klassen' && unter === 'lernstand') || bereich === 'schueler' || (bereich === 'pakete' && unter === 'vorschau')
  const inhalt = (
    <>
      {bereich === 'klassen' && !id && <KlassenListe />}
      {bereich === 'klassen' && id && !unter && <KlasseDetail klasseId={id} />}
      {bereich === 'klassen' && id && unter === 'lernstand' && <KlassenLernstand klasseId={id} />}
      {bereich === 'schueler' && id && <SchuelerLernstand schuelerId={id} />}
      {bereich === 'einstellungen' && <EinstellungenSeite />}
      {bereich === 'aufgaben' && !id && <AufgabenListe />}
      {bereich === 'aufgaben' && id && (
        <AufgabeEditor
          key={id}
          aufgabeId={id.startsWith('neu') ? null : id}
          neuerTyp={id === 'neu-auswahl' ? 'auswahl' : id === 'neu-zuordnen' ? 'zuordnen' : id === 'neu-fehler' ? 'fehler' : id === 'neu-reihenfolge' ? 'reihenfolge' : id === 'neu-ueberarbeiten' ? 'ueberarbeiten' : 'lueckentext'}
        />
      )}
      {bereich === 'pakete' && !id && <PaketListe />}
      {bereich === 'pakete' && id && <PaketDetail paketId={id} vorschau={unter === 'vorschau'} />}
      {bereich === 'kompetenzen' && <Kompetenzen />}
    </>
  )

  return (
    <LehrkraftRahmen bereich={bereich} eigeneKarten={eigeneKarten}>
      {inhalt}
    </LehrkraftRahmen>
  )
}

const MENUE: [string, string][] = [
  ['klassen', 'Klassen'],
  ['aufgaben', 'Aufgaben'],
  ['pakete', 'Aufgabenpakete'],
  ['kompetenzen', 'Kompetenzen'],
  ['einstellungen', 'Einstellungen'],
]

// Lehrkraft-Bereich: schulblaue Seitenleiste (aes-nav) mit Platz fürs Schullogo, ruhiger Abendhimmel oben,
// Inhalte auf großen weißen Karten mit viel Fläche für Tabellen und Formulare.
export function LehrkraftRahmen({ bereich, eigeneKarten, children }: { bereich: string; eigeneKarten: boolean; children: ReactNode }) {
  return (
    <div className="lehrkraft rahmen rahmen--lehrkraft">
      <nav className="aes-nav rahmen__nav" aria-label="Hauptmenü">
        <div className="logo-platz" aria-hidden="true" />
        <div className="aes-nav__brand">Übungswiese</div>
        {MENUE.map(([ziel, text]) => (
          <a
            key={ziel}
            className="aes-nav__item"
            href={`#/lehrkraft/${ziel}`}
            aria-current={bereich === ziel || (ziel === 'klassen' && bereich === 'schueler') ? 'page' : undefined}
          >
            <span className="aes-nav__dot" aria-hidden="true" />
            {text}
          </a>
        ))}
        <button className="aes-nav__item rahmen__abmelden" onClick={() => void supabase.auth.signOut()}>
          <span className="aes-nav__dot" aria-hidden="true" />
          Abmelden
        </button>
      </nav>
      <main className="rahmen__inhalt rahmen__inhalt--breit">
        {eigeneKarten ? children : <div className="aes-card seiten-karte">{children}</div>}
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
    <div className="abendhimmel">
    <main className="seite schmal">
      <div className="aes-card">
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
        <button className="aes-btn aes-btn--primary" disabled={beschaeftigt}>
          {beschaeftigt ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
      <p className="aes-card__hint">
        Schüler:innen brauchen keine Anmeldung. Sie öffnen ihren persönlichen Link.
      </p>
      </div>
    </main>
    </div>
  )
}

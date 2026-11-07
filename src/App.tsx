import { lazy, Suspense, type ReactNode } from 'react'
import { LehrkraftBereich } from './lehrkraft/LehrkraftBereich'
import { usePfad } from './lib/router'
import { useNeueVersion } from './lib/version'
import { SchuelerBereich } from './schueler/SchuelerBereich'

// Vorschauseite mit Beispieldaten – nur beim Entwickeln auf dem eigenen Rechner, nie in der veröffentlichten App.
const Vorschau = import.meta.env.DEV ? lazy(() => import('./entwicklung/Vorschau').then((m) => ({ default: m.Vorschau }))) : null

// Startpunkt der App: entscheidet anhand der Adresse, welcher Bereich angezeigt wird.
//   #/s/<token>/...   → Schüler:innen (persönlicher Link)
//   #/lehrkraft/...   → Lehrkraft (mit Anmeldung)
function App() {
  const neueVersion = useNeueVersion()
  return (
    <>
      {neueVersion && (
        <div className="aes-card neue-version" role="status">
          <span>Es gibt eine neue Version der Übungswiese.</span>
          <button className="aes-btn aes-btn--primary" onClick={() => window.location.reload()}>
            Neu laden
          </button>
        </div>
      )}
      <Bereich />
    </>
  )
}

function Bereich(): ReactNode {
  const pfad = usePfad()
  const [bereich, ...rest] = pfad

  if (bereich === 's' && rest[0]) return <SchuelerBereich key={rest[0]} token={rest[0]} pfad={rest.slice(1)} />
  if (bereich === 'lehrkraft') return <LehrkraftBereich pfad={rest} />
  if (bereich === 'vorschau' && Vorschau)
    return (
      <Suspense fallback={null}>
        <Vorschau />
      </Suspense>
    )

  return (
    <div className="wiese">
      <main className="seite schmal">
        <div className="aes-card">
          <div className="logo-platz" aria-hidden="true" />
          <h1>Übungswiese</h1>
          <p>
            <strong>Schüler:innen:</strong> Bitte öffnet euren persönlichen Link, den ihr von eurer Lehrkraft bekommen habt.
          </p>
          <a className="aes-btn aes-btn--secondary" href="#/lehrkraft">
            Anmeldung für Lehrkräfte
          </a>
        </div>
      </main>
    </div>
  )
}

export default App

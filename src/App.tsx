import { LehrkraftBereich } from './lehrkraft/LehrkraftBereich'
import { usePfad } from './lib/router'
import { SchuelerBereich } from './schueler/SchuelerBereich'

// Startpunkt der App: entscheidet anhand der Adresse, welcher Bereich angezeigt wird.
//   #/s/<token>/...   → Schüler:innen (persönlicher Link)
//   #/lehrkraft/...   → Lehrkraft (mit Anmeldung)
function App() {
  const pfad = usePfad()
  const [bereich, ...rest] = pfad

  if (bereich === 's' && rest[0]) return <SchuelerBereich key={rest[0]} token={rest[0]} pfad={rest.slice(1)} />
  if (bereich === 'lehrkraft') return <LehrkraftBereich pfad={rest} />

  return (
    <main className="seite schmal">
      <h1>Deutsch üben</h1>
      <p>
        <strong>Schüler:innen:</strong> Bitte öffnet euren persönlichen Link, den ihr von eurer Lehrkraft bekommen habt.
      </p>
      <p>
        <a className="knopf" href="#/lehrkraft">
          Anmeldung für Lehrkräfte
        </a>
      </p>
    </main>
  )
}

export default App

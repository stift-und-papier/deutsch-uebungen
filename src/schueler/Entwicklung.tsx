import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { supabase } from '../lib/supabase'

// "Meine Entwicklung": nur die eigene Entwicklung in Worten – keine Stufen, Punkte, Prozente oder Noten.
// Die Datenbank liefert hier auch gar keine absoluten Werte (siehe schueler_entwicklung).

type Kategorie = 'deutlich' | 'besser' | 'dranbleiben' | 'erste'
type Daten = {
  kompetenzen: { name: string; bereich: string; kategorie: Kategorie; geloest: number }[]
  texte: Record<string, string>
  naechster_schritt: string | null
}

const REIHENFOLGE: { kategorie: Kategorie; symbol: string }[] = [
  { kategorie: 'deutlich', symbol: '🚀' },
  { kategorie: 'besser', symbol: '📈' },
  { kategorie: 'dranbleiben', symbol: '💪' },
  { kategorie: 'erste', symbol: '🌱' },
]

export function Entwicklung({ token, zurueck }: { token: string; zurueck: string }) {
  const [daten, setDaten] = useState<Daten | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .rpc('schueler_entwicklung', { p_token: token })
      .then(({ data, error }) => (error ? setFehler(fehlerText(error)) : setDaten(data as Daten)))
  }, [token])

  if (fehler) return <p className="hinweis-box">{fehler}</p>
  if (!daten) return <p>Einen Moment …</p>

  return (
    <>
      <a className="zurueck" href={zurueck}>
        ← Zu den Übungen
      </a>
      <h1>Meine Entwicklung</h1>

      {daten.kompetenzen.length === 0 ? (
        <p>Sobald du ein paar Aufgaben bearbeitet hast, siehst du hier, wie du dich entwickelst.</p>
      ) : (
        <>
          {daten.naechster_schritt && (
            <p className="naechster-schritt">
              👉 {daten.texte.naechster_schritt} <strong>{daten.naechster_schritt}</strong>
            </p>
          )}
          {REIHENFOLGE.map(({ kategorie, symbol }) => {
            const eintraege = daten.kompetenzen.filter((k) => k.kategorie === kategorie)
            if (eintraege.length === 0) return null
            return (
              <section key={kategorie} className={`entwicklung entwicklung-${kategorie}`}>
                <h2>
                  <span aria-hidden="true">{symbol}</span> {daten.texte[kategorie]}
                </h2>
                <ul>
                  {eintraege.map((k) => (
                    <li key={k.name}>
                      <strong>{k.name}</strong>
                      {k.geloest > 0 && (
                        <span className="klein">
                          {' – '}
                          {daten.texte.gelungen
                            .replace('{anzahl}', String(k.geloest))
                            .replace('{aufgaben}', k.geloest === 1 ? 'Aufgabe' : 'Aufgaben')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}

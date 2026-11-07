import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { supabase } from '../lib/supabase'

// „Mein Lernweg“: nur die eigene Entwicklung in Worten – keine Stufen, Punkte, Prozente oder Noten.
// Die Datenbank liefert hier auch gar keine absoluten Werte (siehe schueler_entwicklung).
// Darstellung mit dem Baustein GrowthTile (aes-growth) aus dem Design-System.

type Kategorie = 'deutlich' | 'besser' | 'dranbleiben' | 'erste'
type Daten = {
  kompetenzen: { name: string; bereich: string; kategorie: Kategorie; geloest: number }[]
  texte: Record<string, string>
  naechster_schritt: string | null
}

// Zuordnung zu den vier Zuständen der Entwicklungskachel. Die Segmente zeigen den Weg, nicht ein Niveau.
// „Deutlich besser“ ist zusätzlich hervorgehoben (kräftig grüne Pille, siehe index.css).
const ZUSTAND: Record<Kategorie, { klasse: string; zeichen: string; segmente: number }> = {
  deutlich: { klasse: 'stark', zeichen: '↗', segmente: 4 },
  besser: { klasse: 'gut', zeichen: '↗', segmente: 3 },
  dranbleiben: { klasse: 'dran', zeichen: '→', segmente: 2 },
  erste: { klasse: 'sammeln', zeichen: '…', segmente: 0 },
}
const REIHENFOLGE: Kategorie[] = ['deutlich', 'besser', 'dranbleiben', 'erste']

type Props = { token: string; pseudonym: string; geschafft: number; uebungen: string }

export function Entwicklung({ token, pseudonym, geschafft, uebungen }: Props) {
  const [daten, setDaten] = useState<Daten | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .rpc('schueler_entwicklung', { p_token: token })
      .then(({ data, error }) => (error ? setFehler(fehlerText(error)) : setDaten(data as Daten)))
  }, [token])

  if (fehler) return <p className="hinweis-box">{fehler}</p>
  if (!daten) return <p className="aes-card">Einen Moment …</p>

  const gelungen = (anzahl: number) =>
    daten.texte.gelungen.replace('{anzahl}', String(anzahl)).replace('{aufgaben}', anzahl === 1 ? 'Aufgabe' : 'Aufgaben')
  const sortiert = [...daten.kompetenzen].sort((a, b) => REIHENFOLGE.indexOf(a.kategorie) - REIHENFOLGE.indexOf(b.kategorie))

  return (
    <>
      <header className="aes-card seitenkopf">
        <div>
          <h1 className="titel-gross">Dein Lernweg</h1>
          <p className="seitenkopf__text">Hallo {pseudonym}! Schau, was du schon geschafft hast.</p>
        </div>
        <div className="zaehler">
          <span className="zaehler__zahl">{geschafft}</span>
          <span className="zaehler__text">{geschafft === 1 ? 'Übung geschafft' : 'Übungen geschafft'}</span>
        </div>
      </header>

      {sortiert.length === 0 ? (
        <p className="aes-card">Sobald du ein paar Aufgaben bearbeitet hast, siehst du hier deinen Weg.</p>
      ) : (
        <ul className="karten-raster">
          {sortiert.map((k) => {
            const z = ZUSTAND[k.kategorie]
            return (
              <li key={k.name}>
                <article className={`aes-growth aes-growth--${z.klasse}`}>
                  <span className="aes-growth__topic">{k.bereich}</span>
                  <h2 className="aes-growth__title">{k.name}</h2>
                  <span className="aes-growth__badge">
                    <span aria-hidden="true">{z.zeichen}</span> {daten.texte[k.kategorie]}
                  </span>
                  <div className="aes-growth__steps" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={i < z.segmente ? 'aes-growth__step is-on' : 'aes-growth__step'} />
                    ))}
                  </div>
                  <p className="aes-growth__next">
                    {k.geloest > 0
                      ? gelungen(k.geloest)
                      : k.kategorie === 'erste'
                        ? 'Bearbeite noch ein paar Aufgaben, dann siehst du hier deinen Weg.'
                        : 'Du bist auf dem Weg. Übe weiter mit den Aufgaben aus deinem Paket.'}
                  </p>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <section className="aes-card naechster-schritt">
        <div>
          <h2 className="aes-card__title">Dein nächster Schritt</h2>
          <p className="seitenkopf__text">
            {daten.naechster_schritt ? (
              <>
                {daten.texte.naechster_schritt} <strong>{daten.naechster_schritt}</strong>
              </>
            ) : (
              'Mach weiter mit deinen Übungen.'
            )}
          </p>
        </div>
        <a className="aes-btn aes-btn--primary" href={uebungen}>
          Weiter üben
        </a>
      </section>
    </>
  )
}

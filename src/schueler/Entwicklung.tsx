import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { BEREICH_ICON, ENTWICKLUNG_ICON, PixelIcon } from '../lib/icons'
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

// Zuordnung zu den vier Entwicklungszuständen (Pille aes-growth__badge mit Wachstums-Icon).
// Bewusst ohne Segment-Balken: der sah wie eine Stufenanzeige aus. „Deutlich besser“ = kräftig grüne Pille (index.css).
const ZUSTAND: Record<Kategorie, { klasse: keyof typeof ENTWICKLUNG_ICON }> = {
  deutlich: { klasse: 'stark' },
  besser: { klasse: 'gut' },
  dranbleiben: { klasse: 'dran' },
  erste: { klasse: 'sammeln' },
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
  // Themen mit Entwicklung nach Bereich gruppiert (Reihenfolge der Bereiche wie von der Datenbank geliefert);
  // Themen, zu denen noch Ergebnisse gesammelt werden, kommen eingeklappt ans Ende.
  const mitWeg = daten.kompetenzen.filter((k) => k.kategorie !== 'erste')
  const ersteSchritte = daten.kompetenzen.filter((k) => k.kategorie === 'erste')
  const bereiche = [...new Set(mitWeg.map((k) => k.bereich))].map((bereich) => ({
    bereich,
    themen: mitWeg
      .filter((k) => k.bereich === bereich)
      .sort((a, b) => REIHENFOLGE.indexOf(a.kategorie) - REIHENFOLGE.indexOf(b.kategorie)),
  }))

  const naechsterSchritt = (
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
  )

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

      {naechsterSchritt}

      {daten.kompetenzen.length === 0 && (
        <p className="aes-card">Sobald du ein paar Aufgaben bearbeitet hast, siehst du hier deinen Weg.</p>
      )}

      {bereiche.map(({ bereich, themen }) => (
        <section key={bereich} className="aes-card lernweg-bereich">
          <h2 className="lernweg-bereich__titel">
            <PixelIcon name={BEREICH_ICON[bereich]} />
            {bereich}
          </h2>
          <ul className="lernweg-liste">
            {themen.map((k) => {
              const z = ZUSTAND[k.kategorie]
              return (
                <li key={k.name} className={`lernweg-thema aes-growth--${z.klasse}`}>
                  <div>
                    <h3 className="lernweg-thema__name">{k.name}</h3>
                    {k.geloest > 0 && <p className="lernweg-thema__zusatz">{gelungen(k.geloest)}</p>}
                  </div>
                  <span className="aes-growth__badge">
                    <PixelIcon name={ENTWICKLUNG_ICON[z.klasse]} /> {daten.texte[k.kategorie]}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {ersteSchritte.length > 0 && (
        <details className="aes-card lernweg-bereich lernweg-erste">
          <summary className="lernweg-erste__knopf">
            <PixelIcon name={ENTWICKLUNG_ICON.sammeln} />
            <span>
              {ersteSchritte.length === 1 ? 'Ein Thema' : `${ersteSchritte.length} Themen`}, bei denen wir noch deine ersten
              Ergebnisse sammeln
            </span>
          </summary>
          <ul className="lernweg-liste">
            {ersteSchritte.map((k) => (
              <li key={k.name} className="lernweg-thema">
                <div>
                  <h3 className="lernweg-thema__name">{k.name}</h3>
                  <p className="lernweg-thema__zusatz">{k.bereich}</p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

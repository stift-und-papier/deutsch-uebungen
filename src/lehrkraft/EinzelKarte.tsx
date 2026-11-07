import { datum, type Auswertung, type Einstellungen } from '../lib/lernstand'
import type { Klasse, Kompetenz, Schueler } from '../lib/typen'
import { StufenStreifen, Verlauf } from './LernstandAnzeige'

type Props = {
  schueler: Schueler
  klasse: Klasse
  kompetenzen: Kompetenz[]
  /** Auswertung je Kompetenz-ID */
  daten: Map<string, Auswertung>
  einstellungen: Einstellungen
  /** Knopf „Als PDF“ anzeigen (nicht in der Druckansicht selbst) */
  pdfLink?: string
  /** Verlauf und Wortlaut gleich aufgeklappt (Einzelseite und Ausdruck) */
  verlaufOffen?: boolean
}

// Einzelansicht einer Schülerin / eines Schülers: Stufenbalken je Kompetenz mit Start, Trend und Verlauf.
// Nur für die Lehrkraft – Schüler:innen sehen ausschließlich ihre Entwicklung.
export function EinzelKarte({ schueler, klasse, kompetenzen, daten, einstellungen, pdfLink, verlaufOffen = false }: Props) {
  const liste = kompetenzen.filter((k) => daten.has(k.id))
  const bereiche = [...new Set(liste.map((k) => k.bereich))]

  return (
    <section className="aes-card einzelkarte" aria-label={`Einzelansicht ${schueler.pseudonym}`}>
      <div className="einzelkarte__kopf">
        <div>
          <h2 className="aes-card__title">{schueler.pseudonym}</h2>
          <p className="aes-card__hint">
            Klasse {klasse.name} · Bewertet nach Kerncurriculum {schueler.kerncurriculum ?? '(nicht eingestellt)'} · Stand{' '}
            {datum(new Date().toISOString())}
          </p>
        </div>
        {pdfLink && (
          <a className="aes-btn aes-btn--soft nicht-drucken" href={pdfLink}>
            Als PDF
          </a>
        )}
      </div>

      {!schueler.kerncurriculum ? (
        <p className="hinweis-box">Bitte zuerst in der Klasse das Kerncurriculum einstellen.</p>
      ) : liste.length === 0 ? (
        <p>Noch keine Ergebnisse zu Kompetenzen.</p>
      ) : (
        bereiche.map((bereich) => (
          <div key={bereich} className="einzelkarte__bereich">
            <h3 className="einzelkarte__bereichstitel">{bereich}</h3>
            {liste
              .filter((k) => k.bereich === bereich)
              .map((k) => {
                const a = daten.get(k.id) as Auswertung
                return (
                  <div key={k.id} className="einzelkarte__kompetenz">
                    <StufenStreifen a={a} e={einstellungen} name={k.kurzname || k.bereich} />
                    <details className="einzelkarte__mehr" open={verlaufOffen}>
                      <summary>Verlauf und Wortlaut</summary>
                      <p className="aes-card__hint">{k.kompetenz}</p>
                      <Verlauf a={a} e={einstellungen} />
                    </details>
                  </div>
                )
              })}
          </div>
        ))
      )}
    </section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import type { Auswertung, Einstellungen } from '../lib/lernstand'
import { supabase } from '../lib/supabase'
import type { Klasse, Kompetenz, Schueler } from '../lib/typen'
import { EinzelKarte } from './EinzelKarte'
import { Legende, StufenFeld } from './LernstandAnzeige'

type Zeile = { schueler_id: string; kompetenz_id: string; daten: Auswertung | null }

// Auswertung einer Klasse (Entwurf „Lehrkraft Auswertung“): lädt die Daten und zeigt sie an.
export function KlassenLernstand({ klasseId }: { klasseId: string }) {
  const [daten, setDaten] = useState<{
    klasse: Klasse
    schueler: Schueler[]
    kompetenzen: Kompetenz[]
    werte: Zeile[]
    einstellungen: Einstellungen
  } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      supabase.from('klassen').select('*').eq('id', klasseId).single(),
      supabase.from('schueler').select('*').eq('klasse_id', klasseId).order('pseudonym'),
      supabase.from('kompetenzen').select('*').order('sortierung'),
      supabase.rpc('lernstand_klasse', { p_klasse: klasseId }),
      supabase.from('einstellungen').select('*').single(),
    ]).then(([k, s, ko, l, e]) => {
      const f = [k, s, ko, l, e].find((r) => r.error)
      if (f?.error) return setFehler(fehlerText(f.error))
      const werte = l.data as Zeile[]
      setDaten({
        klasse: k.data as Klasse,
        schueler: s.data as Schueler[],
        kompetenzen: ko.data as Kompetenz[],
        werte,
        einstellungen: e.data as Einstellungen,
      })
      // Zu Beginn die erste Person mit Ergebnissen zeigen
      const ersteMitDaten = (s.data as Schueler[]).find((x) => werte.some((w) => w.schueler_id === x.id))
      setAusgewaehlt(ersteMitDaten?.id ?? null)
    })
  }, [klasseId])

  if (fehler) return <p className="hinweis-box">{fehler}</p>
  if (!daten) return <p className="aes-card">Lädt …</p>
  return <AuswertungAnsicht {...daten} ausgewaehlt={ausgewaehlt} onAuswahl={setAusgewaehlt} />
}

type AnsichtProps = {
  klasse: Klasse
  schueler: Schueler[]
  kompetenzen: Kompetenz[]
  werte: Zeile[]
  einstellungen: Einstellungen
  ausgewaehlt: string | null
  onAuswahl: (id: string) => void
}

// Reine Anzeige (ohne Datenbankzugriff): Heatmap links, Einzelansicht rechts (im Hochformat darunter).
export function AuswertungAnsicht({ klasse, schueler, kompetenzen, werte, einstellungen, ausgewaehlt, onAuswahl }: AnsichtProps) {
  const einzelRef = useRef<HTMLDivElement>(null)
  const wert = useMemo(() => {
    const m = new Map<string, Auswertung>()
    for (const w of werte) if (w.daten) m.set(`${w.schueler_id}:${w.kompetenz_id}`, w.daten)
    return m
  }, [werte])

  const kc = klasse.kerncurriculum
  const mitDaten = new Set(werte.map((w) => w.kompetenz_id))
  const spalten = kompetenzen.filter((k) => k.kerncurriculum === kc && mitDaten.has(k.id))
  const person = schueler.find((s) => s.id === ausgewaehlt)
  const personDaten = new Map(
    werte.filter((w) => w.schueler_id === ausgewaehlt && w.daten).map((w) => [w.kompetenz_id, w.daten as Auswertung]),
  )

  function waehlen(id: string) {
    onAuswahl(id)
    // Im Hochformat steht die Einzelansicht unter der Tabelle: dorthin scrollen
    if (window.matchMedia?.('(max-width: 1100px)').matches) {
      window.setTimeout(() => einzelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  return (
    <>
      <header className="aes-card seitenkopf auswertung-kopf">
        <div>
          <p className="aufgabe-kopf__ort">Lehrkraft-Ansicht · Deutsch</p>
          <h1>Auswertung Klasse {klasse.name}</h1>
          <p className="aes-card__hint">
            Nur für Sie sichtbar. Schüler:innen sehen ausschließlich ihre eigene Entwicklung, nie diese Stände.
          </p>
        </div>
        <div className="auswertung-kopf__rechts">
          <span className="marke">Kerncurriculum: {kc ?? 'nicht eingestellt'}</span>
          <a className="aes-btn aes-btn--secondary" href={`#/lehrkraft/klassen/${klasse.id}`}>
            Zur Klasse
          </a>
        </div>
      </header>

      {!kc && (
        <p className="hinweis-box">Für diese Klasse ist noch kein Kerncurriculum eingestellt. Ohne KC wird kein Lernstand berechnet.</p>
      )}

      <div className="auswertung-raster">
        <section className="aes-card" aria-label="Klassenübersicht">
          <h2 className="aes-card__title">Klassenübersicht</h2>
          <p className="aes-card__hint">Lernstand je Kompetenz. Zeile antippen für die Einzelansicht.</p>
          {spalten.length === 0 ? (
            <p>Noch keine Ergebnisse zu Kompetenzen. Ordnen Sie den Aufgaben Kompetenzen zu, dann erscheinen hier die Ergebnisse.</p>
          ) : (
            <div className="heatmap-rahmen">
              <table className="heatmap">
                <thead>
                  <tr>
                    <th className="heatmap-ecke">Schüler:in</th>
                    {spalten.map((k) => (
                      <th key={k.id} className="heatmap-kopf" scope="col">
                        <span>{k.kurzname || k.bereich}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schueler.map((s) => (
                    <tr key={s.id} className={s.id === ausgewaehlt ? 'ist-ausgewaehlt' : undefined}>
                      <th scope="row">
                        <button
                          type="button"
                          className="heatmap-name"
                          aria-pressed={s.id === ausgewaehlt}
                          onClick={() => waehlen(s.id)}
                        >
                          {s.pseudonym}
                        </button>
                      </th>
                      {spalten.map((k) => (
                        <td key={k.id}>
                          <button
                            type="button"
                            className="heatmap-feld"
                            aria-label={`${s.pseudonym}: ${k.kurzname ?? k.bereich}`}
                            onClick={() => waehlen(s.id)}
                          >
                            <StufenFeld a={wert.get(`${s.id}:${k.id}`)} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Legende />
        </section>

        <div ref={einzelRef}>
          {person ? (
            <EinzelKarte
              schueler={person}
              klasse={klasse}
              kompetenzen={kompetenzen}
              daten={personDaten}
              einstellungen={einstellungen}
              pdfLink={`#/lehrkraft/schueler/${person.id}/drucken`}
            />
          ) : (
            <p className="aes-card">Tippen Sie links auf eine Zeile, dann erscheint hier die Einzelansicht.</p>
          )}
        </div>
      </div>
    </>
  )
}

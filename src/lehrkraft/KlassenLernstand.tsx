import { useEffect, useMemo, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import type { Auswertung, Einstellungen } from '../lib/lernstand'
import { supabase } from '../lib/supabase'
import type { Klasse, Kompetenz, Schueler } from '../lib/typen'
import { Legende, StufenFeld } from './LernstandAnzeige'

type Zeile = { schueler_id: string; kompetenz_id: string; daten: Auswertung | null }

// (a) Klassenübersicht als Heatmap: Schüler:innen × Kompetenzen.
export function KlassenLernstand({ klasseId }: { klasseId: string }) {
  const [klasse, setKlasse] = useState<Klasse | null>(null)
  const [schueler, setSchueler] = useState<Schueler[]>([])
  const [kompetenzen, setKompetenzen] = useState<Kompetenz[]>([])
  const [werte, setWerte] = useState<Zeile[]>([])
  const [einstellungen, setEinstellungen] = useState<Einstellungen | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

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
      setKlasse(k.data as Klasse)
      setSchueler(s.data as Schueler[])
      setKompetenzen(ko.data as Kompetenz[])
      setWerte(l.data as Zeile[])
      setEinstellungen(e.data as Einstellungen)
    })
  }, [klasseId])

  const wert = useMemo(() => {
    const m = new Map<string, Auswertung>()
    for (const w of werte) if (w.daten) m.set(`${w.schueler_id}:${w.kompetenz_id}`, w.daten)
    return m
  }, [werte])

  if (fehler) return <p className="hinweis-box">{fehler}</p>
  if (!klasse || !einstellungen) return <p>Lädt …</p>

  const kc = klasse.kerncurriculum
  const mitDaten = new Set(werte.map((w) => w.kompetenz_id))
  const spalten = kompetenzen.filter((k) => k.kerncurriculum === kc && mitDaten.has(k.id))

  return (
    <>
      <a className="zurueck" href={`#/lehrkraft/klassen/${klasse.id}`}>
        ← Klasse {klasse.name}
      </a>
      <h1>Lernstand – Klasse {klasse.name}</h1>
      {kc ? (
        <p className="klein">Kerncurriculum: {kc}</p>
      ) : (
        <p className="hinweis-box">
          Für diese Klasse ist noch kein Kerncurriculum eingestellt. Ohne KC wird kein Lernstand berechnet.
        </p>
      )}
      {spalten.length === 0 ? (
        <p>Noch keine Ergebnisse zu Kompetenzen. Ordnen Sie den Aufgaben Kompetenzen zu, dann erscheinen hier die Ergebnisse.</p>
      ) : (
        <div className="heatmap-rahmen">
          <table className="heatmap">
            <thead>
              <tr>
                <th>Pseudonym</th>
                {spalten.map((k) => (
                  <th key={k.id} className="heatmap-kopf">
                    <span>{k.kurzname || k.bereich}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schueler.map((s) => (
                <tr key={s.id}>
                  <th>
                    <a href={`#/lehrkraft/schueler/${s.id}`}>{s.pseudonym}</a>
                  </th>
                  {spalten.map((k) => (
                    <td key={k.id}>
                      <a href={`#/lehrkraft/schueler/${s.id}`} aria-label={`${s.pseudonym}: ${k.kurzname ?? k.bereich}`}>
                        <StufenFeld a={wert.get(`${s.id}:${k.id}`)} />
                      </a>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Legende />
      <p className="klein">Ein Klick auf eine Zeile öffnet die Einzelansicht mit Balken und Verlauf.</p>
    </>
  )
}

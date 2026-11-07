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
  const [kc, setKc] = useState<string | null>(null)
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
      const liste = s.data as Schueler[]
      setSchueler(liste)
      setKompetenzen(ko.data as Kompetenz[])
      setWerte(l.data as Zeile[])
      setEinstellungen(e.data as Einstellungen)
      // Häufigstes KC der Klasse vorauswählen
      const zaehler = new Map<string, number>()
      for (const x of liste) if (x.kerncurriculum) zaehler.set(x.kerncurriculum, (zaehler.get(x.kerncurriculum) ?? 0) + 1)
      setKc([...zaehler.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
    })
  }, [klasseId])

  const wert = useMemo(() => {
    const m = new Map<string, Auswertung>()
    for (const w of werte) if (w.daten) m.set(`${w.schueler_id}:${w.kompetenz_id}`, w.daten)
    return m
  }, [werte])

  if (fehler) return <p className="hinweis-box">{fehler}</p>
  if (!klasse || !einstellungen) return <p>Lädt …</p>

  const kcs = [...new Set(schueler.map((s) => s.kerncurriculum).filter(Boolean))] as string[]
  const zeilen = schueler.filter((s) => s.kerncurriculum === kc)
  const mitDaten = new Set(werte.map((w) => w.kompetenz_id))
  const spalten = kompetenzen.filter((k) => k.kerncurriculum === kc && mitDaten.has(k.id))
  const ohneKc = schueler.filter((s) => !s.kerncurriculum).length

  return (
    <>
      <a className="zurueck" href={`#/lehrkraft/klassen/${klasse.id}`}>
        ← Klasse {klasse.name}
      </a>
      <h1>Lernstand – Klasse {klasse.name}</h1>
      {ohneKc > 0 && (
        <p className="hinweis-box">
          Bei {ohneKc} Schüler:innen ist noch kein Kerncurriculum eingestellt. Ohne KC wird kein Lernstand berechnet.
        </p>
      )}
      {kcs.length > 1 && (
        <div className="umschalter" role="tablist">
          {kcs.map((name) => (
            <button key={name} role="tab" aria-selected={kc === name} onClick={() => setKc(name)}>
              {name}
            </button>
          ))}
        </div>
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
                    <span>{k.kurzname || k.code}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zeilen.map((s) => (
                <tr key={s.id}>
                  <th>
                    <a href={`#/lehrkraft/schueler/${s.id}`}>{s.pseudonym}</a>
                  </th>
                  {spalten.map((k) => (
                    <td key={k.id}>
                      <a href={`#/lehrkraft/schueler/${s.id}`} aria-label={`${s.pseudonym}: ${k.kurzname ?? k.code}`}>
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

import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { datum, type Auswertung, type Einstellungen } from '../lib/lernstand'
import { supabase } from '../lib/supabase'
import type { Klasse, Kompetenz, Schueler } from '../lib/typen'
import { Legende, StufenBalken, Verlauf } from './LernstandAnzeige'

type Zeile = { kompetenz_id: string; daten: Auswertung | null }

// (b) Einzelansicht pro Schüler:in – auch als Druckansicht für Beratungsgespräche.
export function SchuelerLernstand({ schuelerId }: { schuelerId: string }) {
  const [schueler, setSchueler] = useState<Schueler | null>(null)
  const [klasse, setKlasse] = useState<Klasse | null>(null)
  const [kompetenzen, setKompetenzen] = useState<Kompetenz[]>([])
  const [werte, setWerte] = useState<Zeile[]>([])
  const [einstellungen, setEinstellungen] = useState<Einstellungen | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const s = await supabase.from('schueler').select('*').eq('id', schuelerId).single()
      if (s.error) return setFehler(fehlerText(s.error))
      const [k, ko, l, e] = await Promise.all([
        supabase.from('klassen').select('*').eq('id', s.data.klasse_id).single(),
        supabase.from('kompetenzen').select('*').order('sortierung'),
        supabase.rpc('lernstand_schueler', { p_schueler: schuelerId }),
        supabase.from('einstellungen').select('*').single(),
      ])
      const f = [k, ko, l, e].find((r) => r.error)
      if (f?.error) return setFehler(fehlerText(f.error))
      setSchueler(s.data as Schueler)
      setKlasse(k.data as Klasse)
      setKompetenzen(ko.data as Kompetenz[])
      setWerte(l.data as Zeile[])
      setEinstellungen(e.data as Einstellungen)
    })()
  }, [schuelerId])

  if (fehler) return <p className="hinweis-box">{fehler}</p>
  if (!schueler || !klasse || !einstellungen) return <p>Lädt …</p>

  const daten = new Map(werte.filter((w) => w.daten).map((w) => [w.kompetenz_id, w.daten as Auswertung]))
  const liste = kompetenzen.filter((k) => daten.has(k.id))
  const bereiche = [...new Set(liste.map((k) => k.bereich))]

  return (
    <div className="einzelansicht">
      <div className="nicht-drucken">
        <a className="zurueck" href={`#/lehrkraft/klassen/${klasse.id}/lernstand`}>
          ← Lernstand Klasse {klasse.name}
        </a>
      </div>
      <h1>
        {schueler.pseudonym} <span className="klein">· Klasse {klasse.name}</span>
      </h1>
      <p>
        Kerncurriculum: <strong>{schueler.kerncurriculum ?? 'nicht eingestellt'}</strong>
        <span className="klein"> · Stand: {datum(new Date().toISOString())}</span>
      </p>
      <div className="knopfleiste nicht-drucken">
        <button className="knopf" onClick={() => window.print()}>
          Drucken / als PDF speichern
        </button>
      </div>
      {!schueler.kerncurriculum ? (
        <p className="hinweis-box">Bitte zuerst in der Klasse das Kerncurriculum einstellen.</p>
      ) : liste.length === 0 ? (
        <p>Noch keine Ergebnisse zu Kompetenzen.</p>
      ) : (
        bereiche.map((bereich) => (
          <section key={bereich} className="kasten">
            <h2>{bereich}</h2>
            {liste
              .filter((k) => k.bereich === bereich)
              .map((k) => {
                const a = daten.get(k.id) as Auswertung
                return (
                  <div key={k.id} className="kompetenz-zeile">
                    <div className="kompetenz-name">
                      <strong>{k.kurzname || k.code}</strong>
                      <div className="klein">
                        {k.code}: {k.kompetenz}
                      </div>
                    </div>
                    <StufenBalken a={a} e={einstellungen} />
                    <Verlauf a={a} e={einstellungen} />
                  </div>
                )
              })}
          </section>
        ))
      )}
      <Legende />
      <p className="klein">
        Berechnung: gewichteter Durchschnitt der letzten {einstellungen.anzahl_letzte} gewerteten Versuche (neuere zählen
        mehr; leicht/mittel/schwer höchstens {einstellungen.punkte_leicht}/{einstellungen.punkte_mittel}/
        {einstellungen.punkte_schwer} Punkte). Eine Stufe gibt es ab {einstellungen.min_versuche} Versuchen. Die Startmarke
        zeigt den ersten Stand.
      </p>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import type { Auswertung, Einstellungen } from '../lib/lernstand'
import { supabase } from '../lib/supabase'
import type { Klasse, Kompetenz, Schueler } from '../lib/typen'
import { EinzelKarte } from './EinzelKarte'
import { Legende } from './LernstandAnzeige'

type Zeile = { kompetenz_id: string; daten: Auswertung | null }

// Einzelansicht pro Schüler:in als eigene Seite – auch als Druckansicht für Beratungsgespräche.
export function SchuelerLernstand({ schuelerId, drucken = false }: { schuelerId: string; drucken?: boolean }) {
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

  // Druckansicht: sobald alles geladen ist, den Druckdialog öffnen (dort auch „Als PDF sichern“).
  const fertig = Boolean(schueler && klasse && einstellungen)
  useEffect(() => {
    if (drucken && fertig) {
      const t = window.setTimeout(() => window.print(), 400)
      return () => window.clearTimeout(t)
    }
  }, [drucken, fertig])

  if (fehler) return <p className="hinweis-box">{fehler}</p>
  if (!schueler || !klasse || !einstellungen) return <p className="aes-card">Lädt …</p>

  const daten = new Map(werte.filter((w) => w.daten).map((w) => [w.kompetenz_id, w.daten as Auswertung]))

  return (
    <div className="einzelansicht">
      <div className="knopfleiste nicht-drucken">
        <a className="aes-btn aes-btn--secondary" href={`#/lehrkraft/klassen/${klasse.id}/lernstand`}>
          Zurück zur Auswertung
        </a>
        <button className="aes-btn aes-btn--primary" onClick={() => window.print()}>
          Drucken / als PDF speichern
        </button>
      </div>
      <EinzelKarte
        schueler={schueler}
        klasse={klasse}
        kompetenzen={kompetenzen}
        daten={daten}
        einstellungen={einstellungen}
        verlaufOffen
      />
      <div className="aes-card einzelansicht__fuss">
        <Legende />
        <p className="aes-card__hint">
          Berechnung: gewichteter Durchschnitt der letzten {einstellungen.anzahl_letzte} gewerteten Versuche (neuere zählen
          mehr; leicht/mittel/schwer höchstens {einstellungen.punkte_leicht}/{einstellungen.punkte_mittel}/
          {einstellungen.punkte_schwer} Punkte). Eine Stufe gibt es ab {einstellungen.min_versuche} Versuchen. Die Startmarke
          zeigt den ersten Stand.
        </p>
      </div>
    </div>
  )
}

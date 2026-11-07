import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { schuelerLink } from '../lib/router'
import { supabase } from '../lib/supabase'
import type { Klasse, Schueler } from '../lib/typen'

// Druckblatt mit Pseudonym und persönlichem Link – zum Verteilen über IServ.
export function Linkliste({ klasseId }: { klasseId: string }) {
  const [klasse, setKlasse] = useState<Klasse | null>(null)
  const [schueler, setSchueler] = useState<Schueler[]>([])
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      supabase.from('klassen').select('*').eq('id', klasseId).single(),
      supabase.from('schueler').select('*').eq('klasse_id', klasseId).order('pseudonym'),
    ]).then(([k, s]) => {
      if (k.error || s.error) return setFehler(fehlerText(k.error ?? s.error))
      setKlasse(k.data as Klasse)
      setSchueler(s.data as Schueler[])
    })
  }, [klasseId])

  function alsTabelleSpeichern() {
    // CSV mit Semikolon und BOM, damit Excel/LibreOffice Umlaute richtig anzeigen.
    const zeilen = [['Pseudonym', 'Link'], ...schueler.map((s) => [s.pseudonym, schuelerLink(s.token)])]
    const csv = '﻿' + zeilen.map((z) => z.map((f) => `"${f.replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `Links ${klasse?.name ?? 'Klasse'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (fehler) return <main className="seite"><p className="hinweis-box">{fehler}</p></main>
  if (!klasse) return <main className="seite"><p>Lädt …</p></main>

  return (
    <main className="seite breit linkliste">
      <div className="nicht-drucken">
        <a className="zurueck" href={`#/lehrkraft/klassen/${klasse.id}`}>
          ← Zurück zur Klasse
        </a>
        <p className="hinweis-box">
          Diese Links sind persönlich wie ein Schlüssel: Wer den Link hat, kann als diese Person üben.
          Bitte einzeln verteilen (z. B. per IServ-Nachricht) und nicht öffentlich aushängen.
        </p>
        <div className="knopfleiste">
          <button className="knopf haupt" onClick={() => window.print()}>
            Drucken / als PDF speichern
          </button>
          <button className="knopf" onClick={alsTabelleSpeichern}>
            Als Tabelle speichern (CSV)
          </button>
        </div>
      </div>
      <h1>Persönliche Links – {klasse.name}</h1>
      <table className="tabelle">
        <thead>
          <tr>
            <th>Pseudonym</th>
            <th>Persönlicher Link</th>
          </tr>
        </thead>
        <tbody>
          {schueler.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.pseudonym}</strong>
              </td>
              <td className="link-zelle">{schuelerLink(s.token)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

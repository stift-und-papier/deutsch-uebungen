import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { supabase } from '../lib/supabase'
import { stufeAus, type Aufgabe } from '../lib/typen'
import { Sterne } from '../gemeinsam/Sterne'

export const TYP_NAMEN: Record<Aufgabe['typ'], string> = { lueckentext: 'Lückentext', auswahl: 'Auswahl', zuordnen: 'Zuordnen', fehler: 'Fehler finden', reihenfolge: 'Reihenfolge', ueberarbeiten: 'Sätze verbessern', erklaerung: 'Erklärung' }

export function AufgabenListe() {
  const [aufgaben, setAufgaben] = useState<Aufgabe[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState('')

  useEffect(() => {
    void supabase
      .from('aufgaben')
      .select('*')
      .order('geaendert_am', { ascending: false })
      .then(({ data, error }) => (error ? setFehler(fehlerText(error)) : setAufgaben(data as Aufgabe[])))
  }, [])

  const gefiltert = aufgaben?.filter((a) => a.titel.toLowerCase().includes(suche.toLowerCase()))

  return (
    <>
      <h1>Aufgaben</h1>
      <div className="knopfleiste">
        <a className="aes-btn aes-btn--primary" href="#/lehrkraft/aufgaben/neu">
          + Neue Aufgabe
        </a>
      </div>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      {aufgaben && aufgaben.length > 5 && (
        <label className="formular">
          Suchen
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Titel …" />
        </label>
      )}
      {gefiltert === undefined ? (
        <p>Lädt …</p>
      ) : gefiltert.length === 0 ? (
        <p>Noch keine Aufgaben.</p>
      ) : (
        <table className="tabelle">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Format</th>
              <th>Stufe</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map((a) => (
              <tr key={a.id}>
                <td>
                  <a href={`#/lehrkraft/aufgaben/${a.id}`}>{a.titel}</a>
                </td>
                <td>{TYP_NAMEN[a.typ]}</td>
                <td>{a.typ !== 'erklaerung' && <Sterne stufe={stufeAus(a.schwierigkeit)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { LEERER_FILTER, passt } from '../lib/filter'
import { naechsteSortierung, sortiere, type Sortierung, type Spalte } from '../lib/sortierung'
import { supabase } from '../lib/supabase'
import { stufeAus, type Aufgabe } from '../lib/typen'
import { Sterne } from '../gemeinsam/Sterne'
import { ListenFilter, useKompetenzen } from './ListenFilter'

export const TYP_NAMEN: Record<Aufgabe['typ'], string> = { lueckentext: 'Lückentext', auswahl: 'Auswahl', zuordnen: 'Zuordnen', fehler: 'Fehler finden', reihenfolge: 'Reihenfolge', ueberarbeiten: 'Sätze verbessern', erklaerung: 'Erklärung' }

const SPALTEN: { spalte: Spalte; name: string }[] = [
  { spalte: 'titel', name: 'Titel' },
  { spalte: 'format', name: 'Format' },
  { spalte: 'stufe', name: 'Stufe' },
]

type AufgabeMitKompetenzen = Aufgabe & { aufgabe_kompetenzen: { kompetenz_id: string }[] }

export function AufgabenListe() {
  const [aufgaben, setAufgaben] = useState<AufgabeMitKompetenzen[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [filter, setFilter] = useState(LEERER_FILTER)
  const kompetenzen = useKompetenzen(setFehler)
  // null = wie geladen (zuletzt geändert zuerst)
  const [sortierung, setSortierung] = useState<Sortierung>(null)

  useEffect(() => {
    void supabase
      .from('aufgaben')
      .select('*, aufgabe_kompetenzen(kompetenz_id)')
      .order('geaendert_am', { ascending: false })
      .then(({ data, error }) => (error ? setFehler(fehlerText(error)) : setAufgaben(data as AufgabeMitKompetenzen[])))
  }, [])

  const ids = (a: AufgabeMitKompetenzen) => a.aufgabe_kompetenzen.map((z) => z.kompetenz_id)
  // Erklärseiten haben nie Kompetenzen – bei „ohne Zuordnung“ gibt es dort nichts nachzuarbeiten
  const gefiltert = aufgaben?.filter(
    (a) => !(filter.jahrgang === 'ohne' && a.typ === 'erklaerung') && passt(a.titel, ids(a), filter, kompetenzen),
  )
  const sortiert = gefiltert && sortiere(gefiltert, sortierung, (typ) => TYP_NAMEN[typ])
  const verwendet = [...new Set((aufgaben ?? []).flatMap(ids))].flatMap((id) => kompetenzen.get(id) ?? [])

  return (
    <>
      <h1>Aufgaben</h1>
      <div className="knopfleiste">
        <a className="aes-btn aes-btn--primary" href="#/lehrkraft/aufgaben/neu">
          + Neue Aufgabe
        </a>
      </div>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      {aufgaben && aufgaben.length > 0 && (
        <ListenFilter
          filter={filter}
          onChange={setFilter}
          verwendet={verwendet}
          treffer={gefiltert?.length ?? 0}
          gesamt={aufgaben.length}
          suchText="Titel …"
        />
      )}
      {gefiltert === undefined ? (
        <p>Lädt …</p>
      ) : aufgaben?.length === 0 ? (
        <p>Noch keine Aufgaben.</p>
      ) : gefiltert.length === 0 ? (
        <p>Keine Aufgabe passt zu diesem Filter.</p>
      ) : (
        <table className="tabelle">
          <thead>
            <tr>
              {SPALTEN.map(({ spalte, name }) => {
                const aktiv = sortierung?.spalte === spalte
                const richtung = aktiv ? (sortierung.absteigend ? 'descending' : 'ascending') : undefined
                return (
                  <th key={spalte} aria-sort={richtung}>
                    <button type="button" className="sortier-knopf" onClick={() => setSortierung(naechsteSortierung(sortierung, spalte))}>
                      {name}
                      <span className="sortier-knopf__pfeil" aria-hidden="true">
                        {aktiv ? (sortierung.absteigend ? '▼' : '▲') : '↕'}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortiert?.map((a) => (
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

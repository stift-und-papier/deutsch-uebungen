import { useCallback, useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { gehe } from '../lib/router'
import { supabase } from '../lib/supabase'
import type { Paket } from '../lib/typen'
import { LEERER_FILTER, passt } from '../lib/filter'
import { ListenFilter, useKompetenzen } from './ListenFilter'
import { PaketTags, TagAuswahl } from './PaketTags'

// Kompetenzen eines Pakets = die seiner Aufgaben
type PaketMitAnzahl = Paket & {
  paket_aufgaben: { aufgaben: { aufgabe_kompetenzen: { kompetenz_id: string }[] } | null }[]
  zuweisungen: { count: number }[]
}

export function PaketListe() {
  const [pakete, setPakete] = useState<PaketMitAnzahl[] | null>(null)
  const [titel, setTitel] = useState('')
  const [tags, setTags] = useState<Pick<Paket, 'jahrgaenge' | 'zweige'>>({ jahrgaenge: [], zweige: [] })
  const [fehler, setFehler] = useState<string | null>(null)
  const [filter, setFilter] = useState(LEERER_FILTER)
  const kompetenzen = useKompetenzen(setFehler)

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('pakete')
      .select('*, paket_aufgaben(aufgaben(aufgabe_kompetenzen(kompetenz_id))), zuweisungen(count)')
      .order('erstellt_am', { ascending: false })
    if (error) setFehler(fehlerText(error))
    else setPakete(data as PaketMitAnzahl[])
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  const ids = (p: PaketMitAnzahl) => [
    ...new Set(p.paket_aufgaben.flatMap((pa) => pa.aufgaben?.aufgabe_kompetenzen.map((z) => z.kompetenz_id) ?? [])),
  ]
  const gefiltert = pakete?.filter((p) => passt(p.titel, ids(p), filter, kompetenzen))
  const verwendet = [...new Set((pakete ?? []).flatMap(ids))].flatMap((id) => kompetenzen.get(id) ?? [])

  return (
    <>
      <h1>Aufgabenpakete</h1>
      <p className="klein">Ein Paket bündelt mehrere Aufgaben. Pakete weisen Sie Klassen oder einzelnen Schüler:innen zu.</p>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      {pakete && pakete.length > 0 && (
        <ListenFilter
          filter={filter}
          onChange={setFilter}
          verwendet={verwendet}
          treffer={gefiltert?.length ?? 0}
          gesamt={pakete.length}
          suchText="Paketname …"
        />
      )}
      {pakete === null || gefiltert === undefined ? (
        <p>Lädt …</p>
      ) : pakete.length === 0 ? (
        <p>Noch keine Pakete.</p>
      ) : gefiltert.length === 0 ? (
        <p>Kein Paket passt zu diesem Filter.</p>
      ) : (
        <ul className="kachelliste">
          {gefiltert.map((p) => (
            <li key={p.id}>
              <a className="kachel kachel--mit-tags" href={`#/lehrkraft/pakete/${p.id}`}>
                <span className="kachel__text">
                  <strong>{p.titel}</strong>
                  <span className="klein">
                    {p.paket_aufgaben.length} Aufgaben ·{' '}
                    {(p.zuweisungen[0]?.count ?? 0) === 0 ? 'noch nicht zugewiesen' : `${p.zuweisungen[0].count}× zugewiesen`}
                  </span>
                </span>
                <PaketTags jahrgaenge={p.jahrgaenge} zweige={p.zweige} />
              </a>
            </li>
          ))}
        </ul>
      )}
      <form
        className="formular"
        onSubmit={async (e) => {
          e.preventDefault()
          const { data, error } = await supabase.from('pakete').insert({ titel: titel.trim(), ...tags }).select('id').single()
          if (error) setFehler(fehlerText(error))
          else gehe(`/lehrkraft/pakete/${data.id}`)
        }}
      >
        <label>
          Neues Paket
          <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. das oder dass – Übung 1" required maxLength={120} />
        </label>
        <TagAuswahl wert={tags} onChange={setTags} />
        <button className="aes-btn aes-btn--primary">Anlegen</button>
      </form>
    </>
  )
}

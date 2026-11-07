import { useCallback, useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import { gehe } from '../lib/router'
import { supabase } from '../lib/supabase'
import type { Paket } from '../lib/typen'

type PaketMitAnzahl = Paket & { paket_aufgaben: { count: number }[]; zuweisungen: { count: number }[] }

export function PaketListe() {
  const [pakete, setPakete] = useState<PaketMitAnzahl[] | null>(null)
  const [titel, setTitel] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from('pakete')
      .select('*, paket_aufgaben(count), zuweisungen(count)')
      .order('erstellt_am', { ascending: false })
    if (error) setFehler(fehlerText(error))
    else setPakete(data as PaketMitAnzahl[])
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  return (
    <>
      <h1>Aufgabenpakete</h1>
      <p className="klein">Ein Paket bündelt mehrere Aufgaben. Pakete weisen Sie Klassen oder einzelnen Schüler:innen zu.</p>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      {pakete === null ? (
        <p>Lädt …</p>
      ) : pakete.length === 0 ? (
        <p>Noch keine Pakete.</p>
      ) : (
        <ul className="kachelliste">
          {pakete.map((p) => (
            <li key={p.id}>
              <a className="kachel" href={`#/lehrkraft/pakete/${p.id}`}>
                <strong>{p.titel}</strong>
                <span className="klein">
                  {p.paket_aufgaben[0]?.count ?? 0} Aufgaben ·{' '}
                  {(p.zuweisungen[0]?.count ?? 0) === 0 ? 'noch nicht zugewiesen' : `${p.zuweisungen[0].count}× zugewiesen`}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <form
        className="formular zeile"
        onSubmit={async (e) => {
          e.preventDefault()
          const { data, error } = await supabase.from('pakete').insert({ titel: titel.trim() }).select('id').single()
          if (error) setFehler(fehlerText(error))
          else gehe(`/lehrkraft/pakete/${data.id}`)
        }}
      >
        <label>
          Neues Paket
          <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. das oder dass – Übung 1" required maxLength={120} />
        </label>
        <button className="knopf haupt">Anlegen</button>
      </form>
    </>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { KERNCURRICULA } from '../lib/csv'
import { fehlerText } from '../lib/fehler'
import { supabase } from '../lib/supabase'
import type { Klasse } from '../lib/typen'

type KlasseMitAnzahl = Klasse & { schueler: { count: number }[] }

export function KlassenListe() {
  const [klassen, setKlassen] = useState<KlasseMitAnzahl[] | null>(null)
  const [name, setName] = useState('')
  const [kc, setKc] = useState('')
  const [jahrgang, setJahrgang] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    const { data, error } = await supabase.from('klassen').select('*, schueler(count)').order('name')
    if (error) setFehler(fehlerText(error))
    else setKlassen(data as KlasseMitAnzahl[])
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  return (
    <>
      <h1>Klassen</h1>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      {klassen === null ? (
        <p>Lädt …</p>
      ) : klassen.length === 0 ? (
        <p>Noch keine Klassen. Leg unten die erste an.</p>
      ) : (
        <ul className="kachelliste">
          {klassen.map((k) => (
            <li key={k.id}>
              <a className="kachel" href={`#/lehrkraft/klassen/${k.id}`}>
                <strong>{k.name}</strong>
                <span className="klein">
                  {k.schueler[0]?.count ?? 0} Schüler:innen · {k.kerncurriculum ?? 'KC fehlt'}
                  {k.jahrgang ? ` · Jahrgang ${k.jahrgang}` : ''}
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
          const { error } = await supabase
            .from('klassen')
            .insert({ name: name.trim(), kerncurriculum: kc || null, jahrgang: jahrgang ? Number(jahrgang) : null })
          if (error) setFehler(fehlerText(error))
          else {
            setName('')
            void laden()
          }
        }}
      >
        <label>
          Neue Klasse
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. 7b (2026/27)" required maxLength={60} />
        </label>
        <label>
          Kerncurriculum
          <select value={kc} onChange={(e) => setKc(e.target.value)} required>
            <option value="">– bitte wählen –</option>
            {KERNCURRICULA.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Jahrgang
          <select value={jahrgang} onChange={(e) => setJahrgang(e.target.value)}>
            <option value="">–</option>
            {[5, 6, 7, 8, 9, 10].map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </label>
        <button className="knopf haupt">Anlegen</button>
      </form>
    </>
  )
}

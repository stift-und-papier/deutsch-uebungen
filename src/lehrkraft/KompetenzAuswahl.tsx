import { useEffect, useMemo, useState } from 'react'
import { KERNCURRICULA, STUFEN } from '../lib/csv'
import { supabase } from '../lib/supabase'
import type { Kompetenz } from '../lib/typen'

type Props = { ausgewaehlt: Set<string>; onChange: (neu: Set<string>) => void }

// Kompetenzen für eine Aufgabe auswählen – auch aus mehreren Kerncurricula.
export function KompetenzAuswahl({ ausgewaehlt, onChange }: Props) {
  const [alle, setAlle] = useState<Kompetenz[]>([])
  const [kc, setKc] = useState<Kompetenz['kerncurriculum']>('Realschule')
  const [stufe, setStufe] = useState('alle')
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState(false)

  useEffect(() => {
    void supabase
      .from('kompetenzen')
      .select('*')
      .order('sortierung')
      .then(({ data }) => setAlle((data ?? []) as Kompetenz[]))
  }, [])

  const gewaehlt = alle.filter((k) => ausgewaehlt.has(k.id))
  const treffer = useMemo(
    () =>
      alle.filter(
        (k) =>
          !k.ausgeblendet &&
          k.kerncurriculum === kc &&
          (stufe === 'alle' || k.stufe === stufe) &&
          (!suche || `${k.kurzname ?? ''} ${k.kompetenz} ${k.bereich}`.toLowerCase().includes(suche.toLowerCase())),
      ),
    [alle, kc, stufe, suche],
  )

  function umschalten(id: string) {
    const neu = new Set(ausgewaehlt)
    if (neu.has(id)) neu.delete(id)
    else neu.add(id)
    onChange(neu)
  }

  return (
    <fieldset>
      <legend>Kompetenzen</legend>
      {gewaehlt.length === 0 ? (
        <p className="hinweis-box">
          Noch keine Kompetenz zugeordnet. Ohne Zuordnung fließt die Aufgabe nicht in den Lernstand ein.
        </p>
      ) : (
        <ul className="chip-liste">
          {gewaehlt.map((k) => (
            <li key={k.id} className="chip">
              <span>
                <strong>{k.kurzname || k.bereich}</strong> <span className="klein">({k.kerncurriculum})</span>
              </span>
              <button type="button" onClick={() => umschalten(k.id)} aria-label={`${k.kurzname ?? k.bereich} entfernen`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="knopf klein-knopf" onClick={() => setOffen(!offen)}>
        {offen ? 'Auswahl schließen' : '+ Kompetenzen auswählen'}
      </button>

      {offen && (
        <div className="kompetenz-auswahl">
          <p className="klein">
            Tipp: Eine Aufgabe kann Kompetenzen aus mehreren Kerncurricula haben. Ausgewertet wird jeweils nach dem KC der
            Schülerin oder des Schülers.
          </p>
          <div className="umschalter" role="tablist">
            {KERNCURRICULA.map((name) => (
              <button type="button" key={name} role="tab" aria-selected={kc === name} onClick={() => setKc(name)}>
                {name}
              </button>
            ))}
          </div>
          <div className="formular zeile">
            <label>
              Stufe
              <select value={stufe} onChange={(e) => setStufe(e.target.value)}>
                <option value="alle">alle</option>
                {STUFEN.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Suchen
              <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="z. B. dass, Komma, s-Laute" />
            </label>
          </div>
          <ul className="auswahl-liste">
            {treffer.map((k) => (
              <li key={k.id}>
                <label className="haken">
                  <input type="checkbox" checked={ausgewaehlt.has(k.id)} onChange={() => umschalten(k.id)} />
                  <span>
                    <strong>{k.kurzname || k.bereich}</strong>{' '}
                    <span className="klein">
                      · {k.bereich} · Stufe {k.stufe}
                    </span>
                    <br />
                    <span className="klein">{k.kompetenz}</span>
                  </span>
                </label>
              </li>
            ))}
            {treffer.length === 0 && <li className="klein">Keine passenden Kompetenzen.</li>}
          </ul>
        </div>
      )}
    </fieldset>
  )
}

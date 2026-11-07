import { useCallback, useEffect, useMemo, useState } from 'react'
import { KERNCURRICULA, STUFEN } from '../lib/csv'
import { fehlerText } from '../lib/fehler'
import { supabase } from '../lib/supabase'
import type { Kompetenz } from '../lib/typen'

const STUFEN_TEXT: Record<Kompetenz['stufe'], string> = {
  '6': 'Ende Jg. 6',
  '8': 'Ende Jg. 8',
  '10': 'Ende Jg. 10',
  '6-10': 'Jg. 6–10',
}

// Kompetenzraster ansehen, ändern, ausblenden und ergänzen.
export function Kompetenzen() {
  const [liste, setListe] = useState<Kompetenz[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kc, setKc] = useState<Kompetenz['kerncurriculum']>('Realschule')
  const [stufe, setStufe] = useState<string>('alle')
  const [suche, setSuche] = useState('')
  const [ausgeblendeteZeigen, setAusgeblendeteZeigen] = useState(false)
  const [bearbeitet, setBearbeitet] = useState<Kompetenz | 'neu' | null>(null)

  const laden = useCallback(async () => {
    const { data, error } = await supabase.from('kompetenzen').select('*').order('sortierung').order('code')
    if (error) setFehler(fehlerText(error))
    else setListe(data as Kompetenz[])
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  const gefiltert = useMemo(
    () =>
      (liste ?? []).filter(
        (k) =>
          k.kerncurriculum === kc &&
          (stufe === 'alle' || k.stufe === stufe) &&
          (ausgeblendeteZeigen || !k.ausgeblendet) &&
          (!suche || `${k.kompetenz} ${k.kurzname ?? ''} ${k.hinweis ?? ''}`.toLowerCase().includes(suche.toLowerCase())),
      ),
    [liste, kc, stufe, suche, ausgeblendeteZeigen],
  )
  const bereiche = [...new Set(gefiltert.map((k) => k.bereich))]
  const anzahl = (name: string) => (liste ?? []).filter((k) => k.kerncurriculum === name && !k.ausgeblendet).length

  async function umschalten(k: Kompetenz) {
    const { error } = await supabase.from('kompetenzen').update({ ausgeblendet: !k.ausgeblendet }).eq('id', k.id)
    if (error) setFehler(fehlerText(error))
    else void laden()
  }

  return (
    <>
      <h1>Kompetenzen</h1>
      <p className="klein">
        Grundlage: <code>docs/kompetenzen.csv</code> (nach den Kerncurricula Deutsch Sek I). Ausgeblendete Kompetenzen
        können keinen Aufgaben mehr zugeordnet werden, bleiben aber in bisherigen Ergebnissen erhalten.
      </p>
      {fehler && <p className="hinweis-box">{fehler}</p>}

      <div className="umschalter" role="tablist">
        {KERNCURRICULA.map((name) => (
          <button key={name} role="tab" aria-selected={kc === name} onClick={() => setKc(name)}>
            {name} ({anzahl(name)})
          </button>
        ))}
      </div>

      <div className="formular zeile">
        <label>
          Stufe
          <select value={stufe} onChange={(e) => setStufe(e.target.value)}>
            <option value="alle">alle Stufen</option>
            {STUFEN.map((s) => (
              <option key={s} value={s}>
                {STUFEN_TEXT[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Suchen
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="z. B. s-Laute, Komma …" />
        </label>
        <label className="haken">
          <input type="checkbox" checked={ausgeblendeteZeigen} onChange={(e) => setAusgeblendeteZeigen(e.target.checked)} />
          Ausgeblendete zeigen
        </label>
      </div>

      <div className="knopfleiste">
        <button className="aes-btn aes-btn--secondary" onClick={() => setBearbeitet('neu')}>
          + Eigene Kompetenz hinzufügen
        </button>
      </div>

      {bearbeitet && (
        <KompetenzFormular
          kompetenz={bearbeitet === 'neu' ? null : bearbeitet}
          vorgabeKc={kc}
          onFertig={(neuLaden) => {
            setBearbeitet(null)
            if (neuLaden) void laden()
          }}
        />
      )}

      {liste === null ? (
        <p>Lädt …</p>
      ) : gefiltert.length === 0 ? (
        <p>Keine passenden Kompetenzen.</p>
      ) : (
        bereiche.map((bereich) => (
          <section key={bereich} className="kasten">
            <h2>{bereich}</h2>
            <table className="tabelle kompetenz-tabelle">
              <tbody>
                {gefiltert
                  .filter((k) => k.bereich === bereich)
                  .map((k) => (
                    <tr key={k.id} className={k.ausgeblendet ? 'ausgeblendet' : undefined}>
                      <td className="nicht-umbrechen">
                        <span className="marke">{STUFEN_TEXT[k.stufe]}</span>
                      </td>
                      <td>
                        <strong>{k.kurzname || k.bereich}</strong>
                        <div className="klein">{k.kompetenz}</div>
                        {k.hinweis && <div className="klein">Hinweis: {k.hinweis}</div>}
                        {k.ausgeblendet && <div className="klein">(ausgeblendet)</div>}
                      </td>
                      <td className="aktionen">
                        <button className="aes-btn aes-btn--ghost aes-btn--klein" onClick={() => setBearbeitet(k)}>
                          Ändern
                        </button>
                        <button className="aes-btn aes-btn--ghost aes-btn--klein" onClick={() => void umschalten(k)}>
                          {k.ausgeblendet ? 'Einblenden' : 'Ausblenden'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </>
  )
}

function KompetenzFormular({
  kompetenz,
  vorgabeKc,
  onFertig,
}: {
  kompetenz: Kompetenz | null
  vorgabeKc: Kompetenz['kerncurriculum']
  onFertig: (neuLaden: boolean) => void
}) {
  const [werte, setWerte] = useState({
    code: kompetenz?.code ?? '',
    kerncurriculum: kompetenz?.kerncurriculum ?? vorgabeKc,
    bereich: kompetenz?.bereich ?? '',
    stufe: kompetenz?.stufe ?? '6',
    kompetenz: kompetenz?.kompetenz ?? '',
    kurzname: kompetenz?.kurzname ?? '',
    hinweis: kompetenz?.hinweis ?? '',
  })
  const [fehler, setFehler] = useState<string | null>(null)
  const setze = (feld: keyof typeof werte, wert: string) => setWerte((alt) => ({ ...alt, [feld]: wert }))

  return (
    <form
      className="formular kasten"
      onSubmit={async (e) => {
        e.preventDefault()
        const datensatz = {
          ...werte,
          // Die Kennung wird intern gebraucht, aber nicht mehr angezeigt; eigene Kompetenzen bekommen eine automatische.
          code: werte.code.trim() || `EIGEN-${Date.now().toString(36).toUpperCase()}`,
          bereich: werte.bereich.trim(),
          kompetenz: werte.kompetenz.trim(),
          kurzname: werte.kurzname.trim() || null,
          hinweis: werte.hinweis.trim() || null,
          geaendert_am: new Date().toISOString(),
        }
        const { error } = kompetenz
          ? await supabase.from('kompetenzen').update(datensatz).eq('id', kompetenz.id)
          : await supabase.from('kompetenzen').insert({ ...datensatz, sortierung: 100000 })
        if (error) setFehler(fehlerText(error))
        else onFertig(true)
      }}
    >
      <h2>{kompetenz ? 'Kompetenz ändern' : 'Eigene Kompetenz hinzufügen'}</h2>
      <div className="formular zeile">
        <label>
          Kerncurriculum
          <select value={werte.kerncurriculum} onChange={(e) => setze('kerncurriculum', e.target.value)}>
            {KERNCURRICULA.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Stufe
          <select value={werte.stufe} onChange={(e) => setze('stufe', e.target.value)}>
            {STUFEN.map((s) => (
              <option key={s} value={s}>
                {STUFEN_TEXT[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Bereich
        <input value={werte.bereich} onChange={(e) => setze('bereich', e.target.value)} required placeholder="z. B. Rechtschreibung" />
      </label>
      <label>
        Kompetenz (Wortlaut)
        <textarea rows={3} value={werte.kompetenz} onChange={(e) => setze('kompetenz', e.target.value)} required />
      </label>
      <label>
        Kurzname für Schüler:innen (optional, z. B. „s-Laute“)
        <input value={werte.kurzname} onChange={(e) => setze('kurzname', e.target.value)} maxLength={60} />
      </label>
      <label>
        Hinweis (optional)
        <input value={werte.hinweis} onChange={(e) => setze('hinweis', e.target.value)} />
      </label>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      <div className="knopfleiste">
        <button className="aes-btn aes-btn--primary">Speichern</button>
        <button type="button" className="aes-btn aes-btn--ghost" onClick={() => onFertig(false)}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

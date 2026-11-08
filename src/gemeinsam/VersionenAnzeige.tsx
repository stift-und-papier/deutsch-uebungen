import { useEffect, useState } from 'react'
import type { Antwort, Antworten, Pruefergebnis, VersionenOhneLoesung } from '../lib/typen'

type Props = {
  teile: VersionenOhneLoesung[]
  antworten: Antworten
  onAntwort: (id: number, wert: Antwort) => void
  ergebnis?: Pruefergebnis | null
  loesungen?: Record<number, string[]> | null
  gesperrt?: boolean
}

// Format „Sätze verbessern“: je Satz 2–4 Versionen untereinander, eine antippen.
// Nach dem Prüfen steht unter jeder Version ihr Begründungshinweis (kommt erst mit dem Ergebnis aus der Datenbank).
// Die Hinweise bleiben stehen, auch wenn danach eine andere Version gewählt wird.
export function VersionenAnzeige({ teile, antworten, onAntwort, ergebnis, loesungen, gesperrt }: Props) {
  const [hinweise, setHinweise] = useState<Record<number, string[]>>({})
  useEffect(() => {
    const neu = ergebnis?.luecken.filter((l) => l.id !== null && l.hinweise?.length)
    if (neu?.length) setHinweise((alt) => ({ ...alt, ...Object.fromEntries(neu.map((l) => [l.id, l.hinweise])) }))
  }, [ergebnis])

  return (
    <div className="reihen">
      {teile.map((teil, nr) => {
        const richtig = ergebnis?.luecken.find((l) => l.id === teil.id)?.richtig
        const gewaehlt = Array.isArray(antworten[teil.id]) ? (antworten[teil.id] as number[]).map(Number) : []
        const zustand = richtig === true ? ' versionen--ok' : richtig === false ? ' versionen--again' : ''
        return (
          <div key={teil.id} className="reihe" role="group" aria-label={`Satz ${nr + 1}`}>
            <p className="reihe__nr">
              Satz {nr + 1}
              {richtig === true && <span className="markierung versionen__zeichen--ok" aria-label="richtig"> ✓</span>}
              {richtig === false && <span className="markierung versionen__zeichen--again" aria-label="schau nochmal hin"> ↻</span>}
            </p>
            {teil.kontext && <p className="versionen__kontext">{teil.kontext}</p>}
            <div className={`versionen${zustand}`}>
              {teil.optionen.map((o, i) => (
                <div key={i} className="version">
                  <button
                    type="button"
                    className="aes-choice version__knopf"
                    aria-pressed={gewaehlt.includes(i)}
                    disabled={gesperrt || richtig === true}
                    onClick={() => onAntwort(teil.id, gewaehlt[0] === i ? [] : [i])}
                  >
                    <span className="version__haken" aria-hidden="true">
                      {gewaehlt.includes(i) ? '✓' : ''}
                    </span>
                    {o}
                  </button>
                  {hinweise[teil.id]?.[i] && <p className="version__hinweis">{hinweise[teil.id][i]}</p>}
                </div>
              ))}
            </div>
            {loesungen?.[teil.id] && (
              <p className="reihe__loesung">
                <span className="loesung-anzeige">Besser: {loesungen[teil.id].join(' / ')}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

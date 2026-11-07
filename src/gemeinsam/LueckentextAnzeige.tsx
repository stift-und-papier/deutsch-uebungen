import type { LueckentextInhaltSchueler, Pruefergebnis } from '../lib/typen'
import { lueckenBreite } from '../lib/lueckentext'

type Props = {
  inhalt: LueckentextInhaltSchueler
  antworten: Record<string, string>
  onAntwort: (id: number, wert: string) => void
  ergebnis?: Pruefergebnis | null
  /** Lösungen pro Lücke (nur nach "Lösung ansehen") */
  loesungen?: Record<number, string[]> | null
  gesperrt?: boolean
}

// Zeigt einen Lückentext mit Eingabefeldern.
// Nach dem Prüfen: richtige Lücken grün mit ✓ (gesperrt), andere orange mit ↻ zum erneuten Bearbeiten.
export function LueckentextAnzeige({ inhalt, antworten, onAntwort, ergebnis, loesungen, gesperrt }: Props) {
  const status = new Map(ergebnis?.luecken.map((l) => [l.id, l.richtig]))

  return (
    <p className="lueckentext">
      {inhalt.teile.map((teil, index) => {
        if (teil.t === 'text') return <span key={index}>{teil.v}</span>
        const richtig = status.get(teil.id)
        const wert = antworten[teil.id] ?? ''
        const breite = lueckenBreite(Math.max(wert.length, 4))
        const klasse = richtig === true ? 'luecke richtig' : richtig === false ? 'luecke nochmal' : 'luecke'
        return (
          <span key={index} className="luecke-rahmen">
            <input
              className={klasse}
              aria-label={`Lücke ${teil.id + 1}`}
              value={wert}
              size={breite}
              disabled={gesperrt || richtig === true}
              onChange={(e) => onAntwort(teil.id, e.target.value)}
              // Wichtig für Rechtschreibübungen: keine automatische Korrektur durch das iPad
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="next"
            />
            {richtig === true && <span className="markierung" aria-label="richtig">✓</span>}
            {richtig === false && <span className="markierung" aria-label="noch einmal ansehen">↻</span>}
            {loesungen?.[teil.id] && <span className="loesung-anzeige">{loesungen[teil.id].join(' / ')}</span>}
          </span>
        )
      })}
    </p>
  )
}

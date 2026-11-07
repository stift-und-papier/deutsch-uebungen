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

// Zeigt einen Lückentext mit Eingabefeldern (Baustein aes-gap aus dem Design-System).
// Nach dem Prüfen: richtige Lücken grün mit ✓ (gesperrt), andere warm (Pfirsich) mit ↻ – nie rot.
export function LueckentextAnzeige({ inhalt, antworten, onAntwort, ergebnis, loesungen, gesperrt }: Props) {
  const status = new Map(ergebnis?.luecken.map((l) => [l.id, l.richtig]))

  return (
    <p className="aes-task aufgabe-text">
      {inhalt.teile.map((teil, index) => {
        if (teil.t === 'text') return <span key={index}>{teil.v}</span>
        const richtig = status.get(teil.id)
        const wert = antworten[teil.id] ?? ''
        const breite = lueckenBreite(Math.max(wert.length, 4))
        const klasse = richtig === true ? 'aes-gap aes-gap--ok' : richtig === false ? 'aes-gap aes-gap--again' : 'aes-gap'
        return (
          <span key={index} className="luecke-rahmen">
            <input
              className={klasse}
              style={{ width: `${breite}ch` }}
              aria-label={`Lücke ${teil.id + 1}`}
              value={wert}
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
            {richtig === false && <span className="markierung" aria-label="schau nochmal hin">↻</span>}
            {loesungen?.[teil.id] && <span className="loesung-anzeige">{loesungen[teil.id].join(' / ')}</span>}
          </span>
        )
      })}
    </p>
  )
}

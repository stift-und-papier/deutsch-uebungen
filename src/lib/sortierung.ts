import { stufeAus, type Aufgabe } from './typen'

// Sortierung der Aufgabenliste (Lehrkraft): nach Titel, Format oder Stufe, auf- oder absteigend.
export type Spalte = 'titel' | 'format' | 'stufe'
export type Sortierung = { spalte: Spalte; absteigend: boolean } | null

type Sortierbar = Pick<Aufgabe, 'titel' | 'typ' | 'schwierigkeit'>

const text = (a: string, b: string) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' })

/** Neue Liste in der gewünschten Reihenfolge. Stufe zählt 1 → 2 → 3 Sterne; Erklärseiten (ohne Stufe) stehen dabei
 *  immer am Ende. Bei Gleichstand entscheidet der Titel (immer A → Z). Ohne Sortierung bleibt die Reihenfolge. */
export function sortiere<T extends Sortierbar>(liste: T[], s: Sortierung, formatName: (typ: T['typ']) => string): T[] {
  if (!s) return liste
  const richtung = s.absteigend ? -1 : 1
  return [...liste].sort((a, b) => {
    if (s.spalte === 'stufe') {
      const ea = a.typ === 'erklaerung', eb = b.typ === 'erklaerung'
      if (ea !== eb) return ea ? 1 : -1
      const d = ea ? 0 : stufeAus(a.schwierigkeit) - stufeAus(b.schwierigkeit)
      if (d) return d * richtung
    } else {
      const d = s.spalte === 'titel' ? text(a.titel, b.titel) : text(formatName(a.typ), formatName(b.typ))
      if (d) return d * richtung
    }
    return text(a.titel, b.titel)
  })
}

/** Klick auf eine Spalte: dieselbe Spalte dreht die Richtung um, eine andere beginnt aufsteigend */
export const naechsteSortierung = (s: Sortierung, spalte: Spalte): Sortierung =>
  s?.spalte === spalte ? { spalte, absteigend: !s.absteigend } : { spalte, absteigend: false }

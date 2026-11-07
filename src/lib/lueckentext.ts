import type { LueckentextTeil } from './typen'

// Lückentext-Schreibweise:
//   Ich weiß, [dass] du kommst.            → eine Lücke, Lösung "dass"
//   Wir gehen [Rad fahren/radfahren].      → mehrere richtige Lösungen, getrennt durch /

export type ParseErgebnis = { teile: LueckentextTeil[]; fehler: string[] }

/** Wandelt den Eingabetext mit [Lücken] in Textstücke und Lücken um. */
export function textZuTeilen(text: string): ParseErgebnis {
  const teile: LueckentextTeil[] = []
  const fehler: string[] = []
  let rest = ''
  let id = 0
  let i = 0

  while (i < text.length) {
    const zeichen = text[i]
    if (zeichen === '[') {
      const ende = text.indexOf(']', i + 1)
      const naechsteOeffnung = text.indexOf('[', i + 1)
      if (ende === -1 || (naechsteOeffnung !== -1 && naechsteOeffnung < ende)) {
        fehler.push(`Eine „[“ wird nicht mit „]“ geschlossen (bei Zeichen ${i + 1}).`)
        rest += zeichen
        i++
        continue
      }
      const loesungen = text
        .slice(i + 1, ende)
        .split('/')
        .map((l) => l.trim())
        .filter((l) => l !== '')
      if (loesungen.length === 0) {
        fehler.push(`Lücke ${id + 1} ist noch leer. Bitte die Lösung in die Klammern schreiben.`)
      }
      // Auch leere Lücken bleiben erhalten, damit man sie im Formular ausfüllen kann.
      if (rest) teile.push({ t: 'text', v: rest })
      rest = ''
      teile.push({ t: 'luecke', id: id++, loesungen })
      i = ende + 1
    } else {
      if (zeichen === ']') fehler.push(`Eine „]“ hat keine passende „[“ (bei Zeichen ${i + 1}).`)
      rest += zeichen
      i++
    }
  }
  if (rest) teile.push({ t: 'text', v: rest })
  if (id === 0 && fehler.length === 0) fehler.push('Der Text hat noch keine Lücke. Setze das gesuchte Wort in [eckige Klammern].')
  return { teile, fehler }
}

/** Umkehrung: Textstücke und Lücken wieder als Eingabetext. */
export function teileZuText(teile: LueckentextTeil[]): string {
  return teile.map((t) => (t.t === 'text' ? t.v : `[${t.loesungen.join('/')}]`)).join('')
}

/** Nummeriert die Lücken neu von 0 an (z. B. nach dem Löschen einer Lücke im Formular). */
export function neuNummerieren(teile: LueckentextTeil[]): LueckentextTeil[] {
  let id = 0
  return teile.map((t) => (t.t === 'luecke' ? { ...t, id: id++ } : t))
}

/** Breite eines Eingabefelds in Zeichen: passend zur längsten Lösung, aber nie verräterisch genau. */
export function lueckenBreite(laengsteLoesung: number): number {
  return Math.max(6, Math.ceil((laengsteLoesung + 2) / 4) * 4)
}

import type { LueckentextInhaltSchueler, LueckentextTeil } from './typen'

// Schreibweise im Texteingabe-Modus (für Lückentext und Auswahl, auch gemischt):
//   Ich weiß, [dass] du kommst.            → Lücke, Lösung "dass"
//   Wir gehen [Rad fahren/radfahren].      → Lücke mit mehreren richtigen Lösungen (getrennt durch /)
//   Ich weiß, [das | *dass] du kommst.     → Auswahl: Möglichkeiten mit | trennen, richtige mit * markieren
//   [*Hund | laufen | *Baum]               → Mehrfachauswahl (mehrere *)

export type ParseErgebnis = { teile: LueckentextTeil[]; fehler: string[] }

/** Wandelt den Eingabetext mit [Klammern] in Textstücke, Lücken und Auswahl-Stellen um. */
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
      const innen = text.slice(i + 1, ende)
      if (rest) teile.push({ t: 'text', v: rest })
      rest = ''

      if (innen.includes('|')) {
        // Auswahl-Stelle
        const roh = innen.split('|').map((o) => o.trim())
        const optionen = roh.map((o) => o.replace(/^\*\s*/, '').trim())
        const richtig = roh.flatMap((o, nr) => (o.startsWith('*') ? [nr] : []))
        if (optionen.some((o) => o === '')) fehler.push(`Stelle ${id + 1}: Eine Möglichkeit ist leer. Bitte zwischen den | etwas eintragen.`)
        else if (optionen.length < 2) fehler.push(`Stelle ${id + 1}: Eine Auswahl braucht mindestens zwei Möglichkeiten.`)
        if (richtig.length === 0) fehler.push(`Stelle ${id + 1}: Bitte die richtige Möglichkeit mit * markieren, z. B. [das | *dass].`)
        teile.push({ t: 'auswahl', id: id++, optionen, richtig })
      } else {
        // Lücke – auch leere bleiben erhalten, damit man sie im Formular ausfüllen kann.
        const loesungen = innen
          .split('/')
          .map((l) => l.trim())
          .filter((l) => l !== '')
        if (loesungen.length === 0) fehler.push(`Lücke ${id + 1} ist noch leer. Bitte die Lösung in die Klammern schreiben.`)
        teile.push({ t: 'luecke', id: id++, loesungen })
      }
      i = ende + 1
    } else {
      if (zeichen === ']') fehler.push(`Eine „]“ hat keine passende „[“ (bei Zeichen ${i + 1}).`)
      rest += zeichen
      i++
    }
  }
  if (rest) teile.push({ t: 'text', v: rest })
  if (id === 0 && fehler.length === 0) fehler.push('Der Text hat noch keine Lücke oder Auswahl. Setze sie in [eckige Klammern].')
  return { teile, fehler }
}

/** Eine Stelle wieder in Schreibweise umwandeln (für den Formular-Modus und die Umkehrung). */
export function stelleZuText(t: Exclude<LueckentextTeil, { t: 'text' }>): string {
  if (t.t === 'luecke') return t.loesungen.join('/')
  return t.optionen.map((o, nr) => (t.richtig.includes(nr) ? `*${o}` : o)).join(' | ')
}

/** Umkehrung: Textstücke und Stellen wieder als Eingabetext. */
export function teileZuText(teile: LueckentextTeil[]): string {
  return teile.map((t) => (t.t === 'text' ? t.v : `[${stelleZuText(t)}]`)).join('')
}

/** Nummeriert die Stellen neu von 0 an (z. B. nach dem Löschen einer Lücke im Formular). */
export function neuNummerieren(teile: LueckentextTeil[]): LueckentextTeil[] {
  let id = 0
  return teile.map((t) => (t.t === 'text' ? t : { ...t, id: id++ }))
}

/** Inhalt so, wie Schüler:innen ihn bekommen (für die Vorschau der Lehrkraft) – ohne Lösungen. */
export function ohneLoesung(teile: LueckentextTeil[], darstellung?: LueckentextInhaltSchueler['darstellung']): LueckentextInhaltSchueler {
  return {
    darstellung,
    teile: teile.map((t) =>
      t.t === 'luecke'
        ? { t: 'luecke', id: t.id }
        : t.t === 'auswahl'
          ? { t: 'auswahl', id: t.id, optionen: t.optionen, mehrfach: t.richtig.length > 1 }
          : t,
    ),
  }
}

/** Breite eines Eingabefelds in Zeichen: passend zur längsten Lösung, aber nie verräterisch genau. */
export function lueckenBreite(laengsteLoesung: number): number {
  return Math.max(6, Math.ceil((laengsteLoesung + 2) / 4) * 4)
}

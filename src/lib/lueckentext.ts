import type { LueckentextInhaltSchueler, LueckentextTeil } from './typen'

// Schreibweise im Texteingabe-Modus (für Lückentext und Auswahl, auch gemischt):
//   Ich weiß, [dass] du kommst.            → Lücke, Lösung "dass"
//   Wir gehen [Rad fahren/radfahren].      → Lücke mit mehreren richtigen Lösungen (getrennt durch /)
//   Ich weiß, [das | *dass] du kommst.     → Auswahl: Möglichkeiten mit | trennen, richtige mit * markieren
//   [*Hund | laufen | *Baum]               → Mehrfachauswahl (mehrere *)
//   [Der kleine Hund = Subjekt]            → Zuordnen: Einheit (auch mehrere Wörter) mit ihrer Kategorie
//   Ich [weis -> weiß] es.                 → Fehler finden: Fehlerwort und Verbesserung(en), mehrere mit /
// Beim Format „Zuordnen“ werden zusätzlich alle übrigen Wörter antippbar (Ablenker ohne Kategorie),
// beim Format „Fehler finden“ alle übrigen Wörter samt anhängender Satzzeichen (fehlerfreie Ablenker).

export type ParseErgebnis = { teile: LueckentextTeil[]; fehler: string[] }

/** Wandelt den Eingabetext mit [Klammern] in Textstücke, Lücken, Auswahl-Stellen und Einheiten um. */
export function textZuTeilen(text: string, woerterAntippbar: boolean | 'fehler' = false): ParseErgebnis {
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

      if (innen.includes('->')) {
        // Fehlerwort mit Verbesserung(en)
        const trenner = innen.indexOf('->')
        const v = innen.slice(0, trenner).trim()
        const korrekturen = innen
          .slice(trenner + 2)
          .split('/')
          .map((k) => k.trim())
          .filter(Boolean)
        if (!v || korrekturen.length === 0)
          fehler.push(`Stelle ${id + 1}: Bitte so schreiben: [Fehlerwort -> Verbesserung], z. B. [weis -> weiß].`)
        teile.push({ t: 'wort', id: id++, v, korrekturen })
      } else if (!innen.includes('|') && innen.includes('=')) {
        // Einheit zum Zuordnen: links Wort(e), rechts Kategorie
        const trenner = innen.lastIndexOf('=')
        const v = innen.slice(0, trenner).trim()
        const kategorie = innen.slice(trenner + 1).trim()
        if (!v || !kategorie) fehler.push(`Stelle ${id + 1}: Bitte so schreiben: [Wort = Kategorie], z. B. [Hund = Nomen].`)
        teile.push({ t: 'einheit', id: id++, v, kategorie: kategorie || null })
      } else if (innen.includes('|')) {
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
  if (woerterAntippbar === 'fehler') {
    if (!teile.some((t) => t.t === 'wort') && fehler.length === 0)
      fehler.push('Markieren Sie mindestens einen Fehler, z. B. [weis -> weiß].')
    return { teile: neuNummerieren(teile.flatMap((t) => (t.t === 'text' ? leerzeichenTrennen(t.v) : [t]))), fehler }
  }
  if (woerterAntippbar) {
    if (!teile.some((t) => t.t === 'einheit') && fehler.length === 0)
      fehler.push('Markieren Sie mindestens ein Wort mit seiner Kategorie, z. B. [Hund = Nomen].')
    return { teile: neuNummerieren(teile.flatMap((t) => (t.t === 'text' ? woerterTrennen(t.v) : [t]))), fehler }
  }
  if (id === 0 && fehler.length === 0) fehler.push('Der Text hat noch keine Lücke oder Auswahl. Setze sie in [eckige Klammern].')
  return { teile, fehler }
}

// Wörter (Buchstaben, Ziffern, Bindestrich/Apostroph im Wort) werden antippbar, alles andere bleibt Text.
const WORT = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu

function woerterTrennen(text: string): LueckentextTeil[] {
  const teile: LueckentextTeil[] = []
  let letzte = 0
  for (const treffer of text.matchAll(WORT)) {
    const start = treffer.index ?? 0
    if (start > letzte) teile.push({ t: 'text', v: text.slice(letzte, start) })
    teile.push({ t: 'einheit', id: 0, v: treffer[0], kategorie: null })
    letzte = start + treffer[0].length
  }
  if (letzte < text.length) teile.push({ t: 'text', v: text.slice(letzte) })
  return teile
}

// Beim Fehlerfinden ist alles zwischen Leerzeichen ein Wort – auch mit Satzzeichen („kommst.“), damit
// sich auch Zeichensetzungsfehler markieren lassen.
function leerzeichenTrennen(text: string): LueckentextTeil[] {
  return text
    .split(/(\s+)/)
    .filter((stueck) => stueck !== '')
    // Leerraum und reine Satzzeichen (z. B. der Punkt direkt hinter einer [Klammer]) bleiben normaler Text
    .map(
      (stueck): LueckentextTeil =>
        /^\s+$/.test(stueck) || !/[\p{L}\p{N}]/u.test(stueck)
          ? { t: 'text', v: stueck }
          : { t: 'wort', id: 0, v: stueck, korrekturen: null },
    )
}

/** Kategorien einer Zuordnen-Aufgabe: zuerst die selbst eingetragenen, dann alle im Text verwendeten. */
export function kategorienAus(teile: LueckentextTeil[], eingetragen: string[] = []): string[] {
  const alle = [...eingetragen, ...teile.flatMap((t) => (t.t === 'einheit' && t.kategorie ? [t.kategorie] : []))]
  return [...new Set(alle.map((k) => k.trim()).filter(Boolean))]
}

/** Eine Stelle wieder in Schreibweise umwandeln (für den Formular-Modus und die Umkehrung). */
export function stelleZuText(t: Exclude<LueckentextTeil, { t: 'text' }>): string {
  if (t.t === 'luecke') return t.loesungen.join('/')
  if (t.t === 'einheit') return `${t.v} = ${t.kategorie ?? ''}`
  if (t.t === 'wort') return `${t.v} -> ${(t.korrekturen ?? []).join('/')}`
  return t.optionen.map((o, nr) => (t.richtig.includes(nr) ? `*${o}` : o)).join(' | ')
}

/** Umkehrung: Textstücke und Stellen wieder als Eingabetext. */
export function teileZuText(teile: LueckentextTeil[]): string {
  return teile
    .map((t) =>
      t.t === 'text' || (t.t === 'einheit' && !t.kategorie) || (t.t === 'wort' && !t.korrekturen) ? t.v : `[${stelleZuText(t)}]`,
    )
    .join('')
}

/** Nummeriert die Stellen neu von 0 an (z. B. nach dem Löschen einer Lücke im Formular). */
export function neuNummerieren(teile: LueckentextTeil[]): LueckentextTeil[] {
  let id = 0
  return teile.map((t) => (t.t === 'text' ? t : { ...t, id: id++ }))
}

/** Inhalt so, wie Schüler:innen ihn bekommen (für die Vorschau der Lehrkraft) – ohne Lösungen. */
export function ohneLoesung(
  teile: LueckentextTeil[],
  darstellung?: LueckentextInhaltSchueler['darstellung'],
  kategorien?: string[],
  fehlerOptionen?: { korrigieren?: boolean; anzahl_zeigen?: boolean },
): LueckentextInhaltSchueler {
  return {
    darstellung,
    kategorien,
    korrigieren: fehlerOptionen?.korrigieren,
    anzahl_fehler: fehlerOptionen?.anzahl_zeigen ? teile.filter((t) => t.t === 'wort' && t.korrekturen).length : null,
    teile: teile.map((t) =>
      t.t === 'luecke'
        ? { t: 'luecke', id: t.id }
        : t.t === 'auswahl'
          ? { t: 'auswahl', id: t.id, optionen: t.optionen, mehrfach: t.richtig.length > 1 }
          : t.t === 'einheit'
            ? { t: 'einheit', id: t.id, v: t.v }
            : t.t === 'wort'
              ? { t: 'wort', id: t.id, v: t.v }
              : t,
    ),
  }
}

/** Breite eines Eingabefelds in Zeichen: passend zur längsten Lösung, aber nie verräterisch genau. */
export function lueckenBreite(laengsteLoesung: number): number {
  return Math.max(6, Math.ceil((laengsteLoesung + 2) / 4) * 4)
}

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

// ---- Format „Reihenfolge“ ----
// Schreibweise: Bausteine eines Satzes mit | trennen, in der richtigen Reihenfolge:
//   Varianten: 2                                  ← optional: so viele verschiedene Reihenfolgen sind gefordert
//   Satzart: Aussagesatz                          ← optional, sonst aus dem Schlusszeichen (. ? !)
//   gestern | bin ich | ins Kino | gegangen.
//   ins Kino | bin ich | gestern | gegangen.      ← weitere richtige Reihenfolge (direkt darunter)
//
//   der Hund | bellt | laut.                       ← Leerzeile = neuer Satz
// Schüler:innen sehen die Bausteine ohne großen Satzanfang und ohne Schlusszeichen; beides erscheint erst,
// wenn der Satz richtig liegt. Verglichen wird ohne Groß-/Kleinschreibung und ohne Satzzeichen am Bausteinende.

/** Baustein für den Vergleich vereinheitlichen (entspricht baustein_norm in der Datenbank) */
export function bausteinNorm(v: string): string {
  return v.trim().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '').toLowerCase()
}

const BUCHSTABEN = 'abcdefghijklmnopqrstuvwxyz'

/** Zufällige Kennungen für die Bausteine; sortiert ergeben sie nie die richtige Reihenfolge (wenn möglich). */
export function kennungen(anzahl: number, zufall: () => number = Math.random): string[] {
  for (let versuch = 0; versuch < 50; versuch++) {
    const neu = new Set<string>()
    while (neu.size < anzahl) {
      let k = ''
      for (let i = 0; i < 6; i++) k += BUCHSTABEN[Math.floor(zufall() * BUCHSTABEN.length)]
      neu.add(k)
    }
    const liste = [...neu]
    const sortiert = [...liste].sort()
    if (anzahl < 2 || sortiert.some((k, i) => k !== liste[i])) return liste
  }
  return Array.from({ length: anzahl }, (_, i) => BUCHSTABEN[anzahl - 1 - i].repeat(6))
}

const SATZART_AUS_ZEICHEN: Record<string, string> = { '.': 'Aussagesatz', '?': 'Fragesatz', '!': 'Aufforderungssatz' }

/** Bausteine als fertiger Satz: erster Buchstabe groß, Schlusszeichen am letzten Baustein */
export function satzFertig(bausteine: string[], zeichen: string): string[] {
  return bausteine.map((b, i) => {
    let v = i === 0 ? b.charAt(0).toUpperCase() + b.slice(1) : b
    if (i === bausteine.length - 1) v += zeichen
    return v
  })
}

/** Wandelt den Eingabetext der Lehrkraft in Sätze zum Ordnen um. */
export function reihenZuTeilen(text: string, zufall: () => number = Math.random): ParseErgebnis {
  const teile: LueckentextTeil[] = []
  const fehler: string[] = []
  const bloecke = text
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((z) => z.trim()).filter(Boolean))
    .filter((b) => b.length > 0)

  bloecke.forEach((alleZeilen, nr) => {
    const satz = `Satz ${nr + 1}`
    // Angaben „Satzart: …“ und „Varianten: …“ (beliebige Reihenfolge, eigene Zeilen)
    let satzart = ''
    let varianten = 1
    const zeilen: string[] = []
    for (const z of alleZeilen) {
      const art = /^satzart\s*:\s*(.*)$/i.exec(z)
      const anzahl = /^varianten\s*:\s*(.*)$/i.exec(z)
      if (art) satzart = art[1].trim()
      else if (anzahl) {
        varianten = Number(anzahl[1])
        if (!Number.isInteger(varianten) || varianten < 1 || varianten > 10) {
          fehler.push(`${satz}: Bei „Varianten:“ bitte eine Zahl von 1 bis 10 eintragen.`)
          varianten = 1
        }
      } else zeilen.push(z)
    }
    if (zeilen.length === 0) {
      fehler.push(`${satz}: Es fehlt die Zeile mit den Bausteinen.`)
      return
    }

    // Satzschlusszeichen vom letzten Baustein jeder Zeile abtrennen (es wird erst bei richtiger Lösung gezeigt)
    let zeichen = ''
    const reihen = zeilen.map((z, zeile) => {
      const teileDerZeile = z.split('|').map((s) => s.trim().replace(/\s+/g, ' '))
      const letzter = teileDerZeile.length - 1
      const schluss = /\s*([.?!]+)$/.exec(teileDerZeile[letzter])
      if (schluss) {
        if (zeile === 0) zeichen = schluss[1]
        teileDerZeile[letzter] = teileDerZeile[letzter].slice(0, schluss.index).trim()
      }
      return teileDerZeile
    })
    const [erste] = reihen
    if (erste.length < 2) {
      fehler.push(`${satz}: Bitte die Bausteine mit | trennen, z. B. gestern | bin ich | ins Kino | gegangen.`)
      return
    }
    if (reihen.some((r) => r.some((b) => b === '')))
      fehler.push(`${satz}: Ein Baustein ist leer. Bitte zwischen den | etwas eintragen.`)

    const muster = erste.map(bausteinNorm).sort().join('|')
    const gesehen = new Set<string>()
    reihen.forEach((r, i) => {
      if (i > 0 && r.map(bausteinNorm).sort().join('|') !== muster)
        fehler.push(`${satz}, Zeile ${i + 1}: Diese Reihenfolge muss genau dieselben Bausteine enthalten wie die erste Zeile.`)
      const schluessel = r.map(bausteinNorm).join('|')
      if (gesehen.has(schluessel)) fehler.push(`${satz}, Zeile ${i + 1}: Diese Reihenfolge steht schon in einer Zeile darüber.`)
      gesehen.add(schluessel)
    })

    if (!satzart) satzart = SATZART_AUS_ZEICHEN[zeichen[0]] ?? ''
    if (!satzart)
      fehler.push(`${satz}: Bitte ein Satzschlusszeichen (. ? !) ans Ende setzen oder eine Zeile „Satzart: …“ ergänzen.`)
    if (varianten > reihen.length)
      fehler.push(
        `${satz}: Für ${varianten} Varianten brauchen Sie mindestens ${varianten} verschiedene richtige Reihenfolgen (je eine Zeile).`,
      )

    // Anzeigeform eines Bausteins: so, wie er mitten im Satz steht (kein großer Satzanfang als Hinweis).
    // Steht er in einer anderen Zeile nicht am Anfang, wird diese Schreibweise genommen.
    const anzeige = erste.map((v, i) => {
      if (i > 0) return v
      for (const r of reihen) {
        const stelle = r.findIndex((b, j) => j > 0 && bausteinNorm(b) === bausteinNorm(v))
        if (stelle > 0) return r[stelle]
      }
      return v
    })
    const k = kennungen(erste.length, zufall)
    teile.push({
      t: 'reihe',
      id: nr,
      satzart,
      zeichen,
      varianten,
      bausteine: anzeige.map((v, i) => ({ k: k[i], v })),
      // Lösungen so, wie der fertige Satz aussieht (für „Lösung ansehen“): großer Anfang, Schlusszeichen
      loesungen: reihen.map((r) => satzFertig(r, zeichen)),
    })
  })
  if (bloecke.length === 0) fehler.push('Schreiben Sie mindestens einen Satz, die Bausteine mit | getrennt.')
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
  if (t.t === 'reihe')
    return [
      ...(t.varianten > 1 ? [`Varianten: ${t.varianten}`] : []),
      ...(t.satzart && t.satzart !== SATZART_AUS_ZEICHEN[t.zeichen[0]] ? [`Satzart: ${t.satzart}`] : []),
      // Bausteine in ihrer Anzeigeform (ohne großen Satzanfang), Schlusszeichen nur am Zeilenende
      ...t.loesungen.map((l) => {
        const zeile = l.map((b) => t.bausteine.find((x) => bausteinNorm(x.v) === bausteinNorm(b))?.v ?? b)
        return zeile.join(' | ') + t.zeichen
      }),
    ].join('\n')
  if (t.t === 'luecke') return t.loesungen.join('/')
  if (t.t === 'einheit') return `${t.v} = ${t.kategorie ?? ''}`
  if (t.t === 'wort') return `${t.v} -> ${(t.korrekturen ?? []).join('/')}`
  return t.optionen.map((o, nr) => (t.richtig.includes(nr) ? `*${o}` : o)).join(' | ')
}

/** Umkehrung: Textstücke und Stellen wieder als Eingabetext. */
export function teileZuText(teile: LueckentextTeil[]): string {
  if (teile.some((t) => t.t === 'reihe'))
    return teile.flatMap((t) => (t.t === 'reihe' ? [stelleZuText(t)] : [])).join('\n\n')
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
              : t.t === 'reihe'
                ? {
                    t: 'reihe',
                    id: t.id,
                    satzart: t.satzart,
                    zeichen: t.zeichen,
                    varianten: t.varianten,
                    bausteine: [...t.bausteine].sort((a, b) => (a.k < b.k ? -1 : 1)),
                  }
                : t,
    ),
  }
}

/** Breite eines Eingabefelds in Zeichen: passend zur längsten Lösung, aber nie verräterisch genau. */
export function lueckenBreite(laengsteLoesung: number): number {
  return Math.max(6, Math.ceil((laengsteLoesung + 2) / 4) * 4)
}

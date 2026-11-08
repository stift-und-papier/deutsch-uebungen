// Liest den Hilfetext (src/schueler/hilfe.md) in Abschnitte und aufklappbare Einträge.
// Absichtlich nur das Nötigste: # Abschnitt, ## Eintrag, Absätze, „- “-Aufzählungen, **fett**.

export type Block = { art: 'absatz'; text: string } | { art: 'liste'; punkte: string[] }
export type Eintrag = { frage: string; bloecke: Block[] }
export type Abschnitt = { titel: string; eintraege: Eintrag[] }

export function hilfeLesen(md: string): Abschnitt[] {
  const abschnitte: Abschnitt[] = []
  let block: Block | null = null
  // Kommentare (der Hinweis-Kasten oben in hilfe.md) zuerst entfernen – darin stehen Beispiel-Zeilen mit #
  for (const roh of md.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const zeile = roh.trim()
    const abschnitt = abschnitte[abschnitte.length - 1]
    const eintrag = abschnitt?.eintraege[abschnitt.eintraege.length - 1]
    if (zeile.startsWith('## ')) {
      abschnitt?.eintraege.push({ frage: zeile.slice(3).trim(), bloecke: [] })
      block = null
    } else if (zeile.startsWith('# ')) {
      abschnitte.push({ titel: zeile.slice(2).trim(), eintraege: [] })
      block = null
    } else if (!eintrag || zeile === '') {
      block = null // Text vor der ersten Frage wird übersprungen
    } else if (zeile.startsWith('- ')) {
      if (block?.art !== 'liste') eintrag.bloecke.push((block = { art: 'liste', punkte: [] }))
      block.punkte.push(zeile.slice(2).trim())
    } else if (block?.art === 'liste') {
      block.punkte[block.punkte.length - 1] += ' ' + zeile // eingerückte Fortsetzung eines Punkts
    } else if (block?.art === 'absatz') {
      block.text += ' ' + zeile
    } else {
      eintrag.bloecke.push((block = { art: 'absatz', text: zeile }))
    }
  }
  return abschnitte
}

/** Zerlegt Text an **fett** in Stücke; ungerade Stücke sind fett. */
export const fettTeile = (text: string) => text.split('**')

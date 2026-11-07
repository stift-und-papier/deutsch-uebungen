// Liest CSV-Dateien, wie Excel und LibreOffice sie mit Semikolon speichern.
// Felder können in "Anführungszeichen" stehen (dann dürfen sie ; und Zeilenumbrüche enthalten, "" = ").

export function csvLesen(text: string, trenner = ';'): string[][] {
  const zeilen: string[][] = []
  let zeile: string[] = []
  let feld = ''
  let inAnfuehrung = false
  const t = text.replace(/^﻿/, '')

  for (let i = 0; i < t.length; i++) {
    const z = t[i]
    if (inAnfuehrung) {
      if (z === '"' && t[i + 1] === '"') {
        feld += '"'
        i++
      } else if (z === '"') {
        inAnfuehrung = false
      } else {
        feld += z
      }
    } else if (z === '"' && feld === '') {
      inAnfuehrung = true
    } else if (z === trenner) {
      zeile.push(feld)
      feld = ''
    } else if (z === '\n' || z === '\r') {
      if (z === '\r' && t[i + 1] === '\n') i++
      zeile.push(feld)
      zeilen.push(zeile)
      zeile = []
      feld = ''
    } else {
      feld += z
    }
  }
  if (feld !== '' || zeile.length > 0) {
    zeile.push(feld)
    zeilen.push(zeile)
  }
  return zeilen.filter((z) => z.some((f) => f.trim() !== ''))
}

export const KERNCURRICULA = ['Gymnasium', 'Realschule', 'Hauptschule'] as const
export type Kerncurriculum = (typeof KERNCURRICULA)[number]
export const STUFEN = ['6', '8', '10', '6-10'] as const

export type KompetenzZeile = {
  code: string
  kerncurriculum: Kerncurriculum
  bereich: string
  stufe: (typeof STUFEN)[number]
  kompetenz: string
  hinweis: string | null
  sortierung: number
}

/** Liest eine Kompetenz-CSV mit den Spalten id;kerncurriculum;bereich;stufe_ende_jahrgang;kompetenz;hinweis */
export function kompetenzenAusCsv(text: string): { zeilen: KompetenzZeile[]; fehler: string[] } {
  const [kopf, ...daten] = csvLesen(text)
  const fehler: string[] = []
  const erwartet = ['id', 'kerncurriculum', 'bereich', 'stufe_ende_jahrgang', 'kompetenz', 'hinweis']
  const spalten = (kopf ?? []).map((s) => s.trim().toLowerCase())
  const index = Object.fromEntries(erwartet.map((name) => [name, spalten.indexOf(name)]))
  for (const name of erwartet.slice(0, 5)) {
    if (index[name] === -1) fehler.push(`Spalte „${name}“ fehlt in der ersten Zeile.`)
  }
  if (fehler.length) return { zeilen: [], fehler }

  const zeilen: KompetenzZeile[] = []
  const codes = new Set<string>()
  daten.forEach((felder, i) => {
    const nr = i + 2
    const wert = (name: string) => (index[name] >= 0 ? (felder[index[name]] ?? '').trim() : '')
    const code = wert('id')
    const kc = wert('kerncurriculum') as Kerncurriculum
    const stufe = wert('stufe_ende_jahrgang') as KompetenzZeile['stufe']
    if (!code) return fehler.push(`Zeile ${nr}: id fehlt.`)
    if (codes.has(code)) return fehler.push(`Zeile ${nr}: id „${code}“ kommt doppelt vor.`)
    if (!KERNCURRICULA.includes(kc)) return fehler.push(`Zeile ${nr}: unbekanntes Kerncurriculum „${kc}“.`)
    if (!STUFEN.includes(stufe)) return fehler.push(`Zeile ${nr}: unbekannte Stufe „${stufe}“ (erlaubt: 6, 8, 10, 6-10).`)
    if (!wert('bereich') || !wert('kompetenz')) return fehler.push(`Zeile ${nr}: Bereich oder Kompetenz fehlt.`)
    codes.add(code)
    zeilen.push({
      code,
      kerncurriculum: kc,
      bereich: wert('bereich'),
      stufe,
      kompetenz: wert('kompetenz'),
      hinweis: wert('hinweis') || null,
      sortierung: (i + 1) * 10,
    })
  })
  return { zeilen, fehler }
}

// Darstellung des Lernstands (nur Lehrkraft-Ansicht).

/** Ergebnis von auswertung() aus der Datenbank */
export type Auswertung = {
  punkte: number | null
  stufe: number | null
  anzahl: number
  start_punkte: number | null
  start_stufe: number | null
  start_zeit: string | null
  vergleich_punkte: number | null
  vergleich_stufe: number | null
  vergleich_zeit: string | null
  neue_seit_vergleich: number | null
  trend_gueltig: boolean
  trend_punkte: number | null
  trend_stufen: number | null
  verlauf: { zeit: string; punkte: number }[] | null
}

export type Einstellungen = {
  owner: string
  min_versuche: number
  anzahl_letzte: number
  abklingen: number
  punkte_leicht: number
  punkte_mittel: number
  punkte_schwer: number
  grenze_minus: number
  grenze_o: number
  grenze_plus: number
  grenze_plusplus: number
  trend_min_neue: number
  trend_min_diff: number
  vergleich_wochen: number | null
  texte: Record<RueckmeldeText, string>
  // Blumenwiese: Blumen je Kompetenz nach Entwicklungszustand + je abgeschlossenem Paket (höchstens wiese_pakete_max)
  wiese_sammeln: number
  wiese_dran: number
  wiese_gut: number
  wiese_stark: number
  wiese_je_paket: number
  wiese_pakete_max: number
}

export type RueckmeldeText = 'deutlich' | 'besser' | 'dranbleiben' | 'erste' | 'gelungen' | 'naechster_schritt'

/** Die fünf Stufen: Symbol, Farbe (rot → gelb → grün, aus tokens.css) und geprüfte Textfarbe */
export const STUFEN = [
  { symbol: '--', name: 'Stufe --', farbe: 'var(--stufe-minus2)', text: 'var(--flaeche)' },
  { symbol: '-', name: 'Stufe -', farbe: 'var(--stufe-minus1)', text: 'var(--tinte)' },
  { symbol: 'o', name: 'Stufe o', farbe: 'var(--stufe-null)', text: 'var(--tinte)' },
  { symbol: '+', name: 'Stufe +', farbe: 'var(--stufe-plus1)', text: 'var(--tinte)' },
  { symbol: '++', name: 'Stufe ++', farbe: 'var(--stufe-plus2)', text: 'var(--flaeche)' },
] as const

/** Punkte (0–100) → Stufe 0..4, wie in der Datenbank (stufe_aus_punkte) */
export function stufeAusPunkte(punkte: number, e: Einstellungen): number {
  if (punkte >= e.grenze_plusplus) return 4
  if (punkte >= e.grenze_plus) return 3
  if (punkte >= e.grenze_o) return 2
  if (punkte >= e.grenze_minus) return 1
  return 0
}

export function datum(zeit: string | null): string {
  return zeit ? new Date(zeit).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
}

/** Textzeile zur Entwicklung, z. B. „+1 Stufe seit 12.10.2026“ */
export function trendText(a: Auswertung, e: Einstellungen): string {
  if (a.punkte === null) return `noch nicht genug Daten (${a.anzahl} von ${e.min_versuche} Versuchen)`
  if (!a.vergleich_zeit) return 'noch kein Vergleich möglich'
  const seit = datum(a.vergleich_zeit)
  if (!a.trend_gueltig) {
    const fehlen = e.trend_min_neue - (a.neue_seit_vergleich ?? 0)
    return fehlen > 0
      ? `noch kein Trend – ${fehlen} weitere Versuch${fehlen === 1 ? '' : 'e'} nötig`
      : `stabil seit ${seit}`
  }
  const stufen = a.trend_stufen ?? 0
  if (stufen !== 0) return `${stufen > 0 ? '+' : '−'}${Math.abs(stufen)} Stufe${Math.abs(stufen) === 1 ? '' : 'n'} seit ${seit}`
  return `${(a.trend_punkte ?? 0) > 0 ? 'verbessert' : 'verschlechtert'} innerhalb der Stufe seit ${seit}`
}

export function trendPfeil(a: Auswertung): string {
  if (!a.trend_gueltig || a.trend_punkte === null) return '→'
  return a.trend_punkte > 0 ? '↗' : '↘'
}

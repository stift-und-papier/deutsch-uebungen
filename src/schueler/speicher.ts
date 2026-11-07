// Zwischenspeicher auf dem iPad (localStorage):
// * Entwürfe: angefangene Antworten, damit nichts verloren geht.
// * Warteschlange: Antworten, die wegen fehlendem Internet noch nicht gesendet werden konnten.
// Alle Zugriffe sind abgesichert, weil der Speicher im privaten Modus fehlen kann.

export type WartenderVersuch = {
  client_id: string
  paket_id: string
  aufgabe_id: string
  antworten: Record<string, string>
  bearbeitet_am: string
}

function lesen<T>(schluessel: string, standard: T): T {
  try {
    const roh = window.localStorage.getItem(schluessel)
    return roh ? (JSON.parse(roh) as T) : standard
  } catch {
    return standard
  }
}

function schreiben(schluessel: string, wert: unknown) {
  try {
    if (wert === null) window.localStorage.removeItem(schluessel)
    else window.localStorage.setItem(schluessel, JSON.stringify(wert))
  } catch {
    // Speicher nicht verfügbar – dann eben ohne Zwischenspeicher.
  }
}

// Der Token wird nur gekürzt als Schlüssel verwendet.
const kurz = (token: string) => token.slice(0, 12)

export function entwurfLesen(token: string, aufgabeId: string): Record<string, string> {
  return lesen(`entwurf:${kurz(token)}:${aufgabeId}`, {})
}

export function entwurfSpeichern(token: string, aufgabeId: string, antworten: Record<string, string> | null) {
  schreiben(`entwurf:${kurz(token)}:${aufgabeId}`, antworten)
}

export function warteschlangeLesen(token: string): WartenderVersuch[] {
  return lesen(`warteschlange:${kurz(token)}`, [])
}

export function warteschlangeSpeichern(token: string, liste: WartenderVersuch[]) {
  schreiben(`warteschlange:${kurz(token)}`, liste.length ? liste : null)
}

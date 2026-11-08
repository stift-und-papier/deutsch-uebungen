import type { Kompetenz } from './typen'

// Filter für Aufgaben- und Paketlisten der Lehrkraft. Jahrgang und Bereich kommen aus den zugeordneten Kompetenzen
// (KC-Stufe „Ende Jg. 6/8/10“ → Doppeljahrgang). Alle gewählten Merkmale müssen bei DERSELBEN Kompetenz zutreffen.

export type Doppeljahrgang = '5/6' | '7/8' | '9/10'
export type Filter = { suche: string; jahrgang: '' | Doppeljahrgang | 'ohne'; bereich: string; kompetenz: string }
export const LEERER_FILTER: Filter = { suche: '', jahrgang: '', bereich: '', kompetenz: '' }
export const DOPPELJAHRGAENGE: Doppeljahrgang[] = ['5/6', '7/8', '9/10']

export type FilterKompetenz = Pick<Kompetenz, 'id' | 'bereich' | 'stufe'>

const JAHRGAENGE: Record<Kompetenz['stufe'], Doppeljahrgang[]> = {
  '6': ['5/6'],
  '8': ['7/8'],
  '10': ['9/10'],
  '6-10': ['5/6', '7/8', '9/10'],
}

/** Passt ein Eintrag (Titel + IDs seiner Kompetenzen) zum Filter? */
export function passt(titel: string, kompetenzIds: string[], f: Filter, kompetenzen: Map<string, FilterKompetenz>): boolean {
  if (f.suche.trim() && !titel.toLowerCase().includes(f.suche.trim().toLowerCase())) return false
  const ks = kompetenzIds.flatMap((id) => kompetenzen.get(id) ?? [])
  if (f.jahrgang === 'ohne') return ks.length === 0
  const jahrgang = f.jahrgang
  if (!jahrgang && !f.bereich && !f.kompetenz) return true
  return ks.some(
    (k) =>
      (!jahrgang || (JAHRGAENGE[k.stufe] ?? []).includes(jahrgang)) &&
      (!f.bereich || k.bereich === f.bereich) &&
      (!f.kompetenz || k.id === f.kompetenz),
  )
}

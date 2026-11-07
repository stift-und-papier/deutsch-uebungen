// Pixel-Icons der Übungswiese (Design-System, Baustein PixelIcons). Nur Schmuck: Der Text daneben trägt die Bedeutung.
// HIER an einer Stelle ergänzen, wenn neue Aufgabenformate oder Kompetenzbereiche dazukommen.

export type IconName =
  | 'haus' | 'buch' | 'flagge' | 'gluehbirne'
  | 'luecke' | 'auswahl' | 'zuordnen' | 'lupe' | 'reihenfolge' | 'dokument'
  | 'buchstabe' | 'bausteine' | 'satz' | 'stift' | 'zeichen' | 'sprechblase'
  | 'blume' | 'spross' | 'giesskanne' | 'samen'
  | 'stern' | 'pokal' | 'herz' | 'ziel' | 'sanduhr' | 'paket' | 'daumen' | 'rakete'

// Aufgabenformat → Icon (Kopf der Aufgabe)
export const FORMAT_ICON: Record<string, IconName> = {
  lueckentext: 'luecke',
  auswahl: 'auswahl',
  zuordnen: 'zuordnen',
  fehler: 'lupe',
  reihenfolge: 'reihenfolge',
  ueberarbeiten: 'dokument',
}

// Kompetenzbereich (Spalte „bereich“ aus kompetenzen.csv) → Icon (Entwicklungskachel)
export const BEREICH_ICON: Record<string, IconName> = {
  Wortarten: 'buchstabe',
  'Wortbildung und Wortschatz': 'bausteine',
  'Satzglieder und Sätze': 'satz',
  Rechtschreibung: 'stift',
  Zeichensetzung: 'zeichen',
  Sprachgebrauch: 'sprechblase',
  'Texte überarbeiten': 'dokument',
}

// Entwicklungszustand → Wachstums-Icon (Badge der Entwicklungskachel). Nie Sterne, Pokale oder Noten-Symbole.
export const ENTWICKLUNG_ICON: Record<'stark' | 'gut' | 'dran' | 'sammeln', IconName> = {
  stark: 'blume',
  gut: 'spross',
  dran: 'giesskanne',
  sammeln: 'samen',
}

// Navigation der Schüleransicht
export const NAV_ICON = { start: 'haus', uebungen: 'buch', lernweg: 'flagge', tipps: 'gluehbirne' } as const

type Props = { name: IconName | undefined; groesse?: 'm' | 'l' | 'xl' }

// Größen: Standard 32 px, m 48 px, l 64 px, xl 96 px (ganzzahlige Vielfache von 16 → scharfe Pixel)
export function PixelIcon({ name, groesse }: Props) {
  if (!name) return null
  return <span className={`aes-icon${groesse ? ` aes-icon--${groesse}` : ''} aes-icon--${name}`} aria-hidden="true" />
}

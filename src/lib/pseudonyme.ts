// Erzeugt Pseudonyme aus Tiername und zweistelliger Nummer, z. B. "Fuchs-07".

export const TIERE = [
  'Adler', 'Biber', 'Dachs', 'Delfin', 'Eule', 'Elch', 'Falke', 'Fuchs', 'Gecko', 'Hase',
  'Igel', 'Kater', 'Koala', 'Kranich', 'Luchs', 'Lama', 'Marder', 'Möwe', 'Otter', 'Panda',
  'Pinguin', 'Rabe', 'Reh', 'Robbe', 'Specht', 'Storch', 'Tiger', 'Wal', 'Wiesel', 'Zebra',
]

/** Erzeugt `anzahl` neue Pseudonyme, die noch nicht in `vorhanden` vorkommen. */
export function erzeugePseudonyme(anzahl: number, vorhanden: string[], zufall: () => number = Math.random): string[] {
  const belegt = new Set(vorhanden.map((p) => p.toLowerCase()))
  // Tiere, die in der Klasse noch nicht vorkommen, zuerst – so klingen die Namen verschieden.
  const benutzteTiere = new Set(vorhanden.map((p) => p.split('-')[0].toLowerCase()))
  const tiere = mischen([...TIERE], zufall).sort(
    (a, b) => Number(benutzteTiere.has(a.toLowerCase())) - Number(benutzteTiere.has(b.toLowerCase())),
  )
  const ergebnis: string[] = []
  let versuche = 0
  while (ergebnis.length < anzahl && versuche < 10000) {
    const tier = tiere[ergebnis.length % tiere.length]
    const nummer = String(1 + Math.floor(zufall() * 99)).padStart(2, '0')
    const name = `${tier}-${nummer}`
    if (!belegt.has(name.toLowerCase())) {
      belegt.add(name.toLowerCase())
      ergebnis.push(name)
    }
    versuche++
  }
  return ergebnis
}

/** Liest eine selbst eingegebene Liste (eine Zeile pro Pseudonym), ohne Leerzeilen und Doppelte. */
export function pseudonymListeLesen(text: string, vorhanden: string[]): { neu: string[]; doppelt: string[] } {
  const belegt = new Set(vorhanden.map((p) => p.toLowerCase()))
  const neu: string[] = []
  const doppelt: string[] = []
  for (const zeile of text.split(/\r?\n/)) {
    const name = zeile.trim()
    if (!name) continue
    if (belegt.has(name.toLowerCase())) {
      doppelt.push(name)
    } else {
      belegt.add(name.toLowerCase())
      neu.push(name)
    }
  }
  return { neu, doppelt }
}

function mischen<T>(liste: T[], zufall: () => number): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1))
    ;[liste[i], liste[j]] = [liste[j], liste[i]]
  }
  return liste
}

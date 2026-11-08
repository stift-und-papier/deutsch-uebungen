import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fettTeile, hilfeLesen } from './hilfe'

describe('Hilfetext lesen', () => {
  it('Abschnitte, Einträge, Absätze, Listen mit Fortsetzung; Kopf-Kommentar fällt weg', () => {
    const md = '<!--\n# kein Abschnitt\n-->\n# A\n## Frage 1\nZeile eins\nzwei\n\nNeuer Absatz\n## Frage 2\n- Punkt\n  weiter\n- Zwei\n# B\n## Frage 3\nText'
    expect(hilfeLesen(md)).toEqual([
      {
        titel: 'A',
        eintraege: [
          { frage: 'Frage 1', bloecke: [{ art: 'absatz', text: 'Zeile eins zwei' }, { art: 'absatz', text: 'Neuer Absatz' }] },
          { frage: 'Frage 2', bloecke: [{ art: 'liste', punkte: ['Punkt weiter', 'Zwei'] }] },
        ],
      },
      { titel: 'B', eintraege: [{ frage: 'Frage 3', bloecke: [{ art: 'absatz', text: 'Text' }] }] },
    ])
  })
  it('fett', () => {
    expect(fettTeile('a **b** c')).toEqual(['a ', 'b', ' c'])
  })
  it('die echte Hilfedatei: zwei Abschnitte, jeder Eintrag hat Text, kein „FAQ“', () => {
    const md = readFileSync(new URL('../schueler/hilfe.md', import.meta.url), 'utf8')
    const a = hilfeLesen(md)
    expect(a.map((x) => x.titel)).toEqual(['Für Eltern und Schüler:innen', 'Das fragst du dich vielleicht'])
    for (const x of a) for (const e of x.eintraege) expect(e.bloecke.length).toBeGreaterThan(0)
    expect(md.split('-->')[1]).not.toMatch(/FAQ/i)
  })
})

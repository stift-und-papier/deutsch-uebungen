import { describe, expect, it } from 'vitest'
import { LEERER_FILTER, passt, type FilterKompetenz } from './filter'

const k = new Map<string, FilterKompetenz>([
  ['r6', { id: 'r6', bereich: 'Rechtschreibung', stufe: '6' }],
  ['w8', { id: 'w8', bereich: 'Wortarten', stufe: '8' }],
  ['s610', { id: 's610', bereich: 'Sprachgebrauch', stufe: '6-10' }],
])
const f = (teil: Partial<typeof LEERER_FILTER>) => ({ ...LEERER_FILTER, ...teil })

describe('Filter für Aufgaben und Pakete', () => {
  it('ohne Filter passt alles', () => {
    expect(passt('x', [], LEERER_FILTER, k)).toBe(true)
  })
  it('sucht im Titel ohne Groß-/Kleinschreibung', () => {
    expect(passt('das oder dass', [], f({ suche: 'DASS' }), k)).toBe(true)
    expect(passt('Kommas', [], f({ suche: 'dass' }), k)).toBe(false)
  })
  it('Jahrgang aus der KC-Stufe; 6-10 gilt für alle', () => {
    expect(passt('a', ['r6'], f({ jahrgang: '5/6' }), k)).toBe(true)
    expect(passt('a', ['r6'], f({ jahrgang: '7/8' }), k)).toBe(false)
    expect(passt('a', ['s610'], f({ jahrgang: '9/10' }), k)).toBe(true)
  })
  it('„ohne Zuordnung“ findet nur Aufgaben ohne Kompetenz', () => {
    expect(passt('a', [], f({ jahrgang: 'ohne' }), k)).toBe(true)
    expect(passt('a', ['r6'], f({ jahrgang: 'ohne' }), k)).toBe(false)
  })
  it('Bereich, Kompetenz und Jahrgang müssen bei derselben Kompetenz zutreffen', () => {
    expect(passt('a', ['r6', 'w8'], f({ bereich: 'Wortarten' }), k)).toBe(true)
    expect(passt('a', ['r6', 'w8'], f({ bereich: 'Rechtschreibung', jahrgang: '7/8' }), k)).toBe(false)
    expect(passt('a', ['r6', 'w8'], f({ bereich: 'Wortarten', kompetenz: 'w8' }), k)).toBe(true)
    expect(passt('a', ['r6'], f({ kompetenz: 'w8' }), k)).toBe(false)
  })
})

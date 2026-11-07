import { describe, expect, it } from 'vitest'
import { neuNummerieren, teileZuText, textZuTeilen } from './lueckentext'

describe('textZuTeilen', () => {
  it('erkennt eine Lücke', () => {
    const { teile, fehler } = textZuTeilen('Ich weiß, [dass] du kommst.')
    expect(fehler).toEqual([])
    expect(teile).toEqual([
      { t: 'text', v: 'Ich weiß, ' },
      { t: 'luecke', id: 0, loesungen: ['dass'] },
      { t: 'text', v: ' du kommst.' },
    ])
  })

  it('erkennt mehrere Lösungen mit /', () => {
    const { teile } = textZuTeilen('Wir gehen [Rad fahren / radfahren].')
    expect(teile[1]).toEqual({ t: 'luecke', id: 0, loesungen: ['Rad fahren', 'radfahren'] })
  })

  it('nummeriert mehrere Lücken fortlaufend', () => {
    const { teile } = textZuTeilen('[Das] Kind, [das] lacht.')
    const ids = teile.filter((t) => t.t === 'luecke').map((t) => (t.t === 'luecke' ? t.id : -1))
    expect(ids).toEqual([0, 1])
  })

  it('meldet fehlende schließende Klammer', () => {
    expect(textZuTeilen('Ich [weiß nicht.').fehler.length).toBeGreaterThan(0)
  })

  it('meldet leere Lücke', () => {
    expect(textZuTeilen('Ich [] gehe [heute].').fehler.length).toBe(1)
  })

  it('meldet Text ganz ohne Lücke', () => {
    expect(textZuTeilen('Kein Platz für Lücken.').fehler.length).toBe(1)
  })

  it('Umwandlung hin und zurück ergibt den gleichen Text', () => {
    const text = 'Ich weiß, [dass] du [Rad fahren/radfahren] willst.'
    expect(teileZuText(textZuTeilen(text).teile)).toBe(text)
  })
})

describe('neuNummerieren', () => {
  it('vergibt Lücken-Nummern neu ab 0', () => {
    const neu = neuNummerieren([
      { t: 'luecke', id: 5, loesungen: ['a'] },
      { t: 'text', v: ' ' },
      { t: 'luecke', id: 9, loesungen: ['b'] },
    ])
    expect(neu.map((t) => (t.t === 'luecke' ? t.id : null))).toEqual([0, null, 1])
  })
})

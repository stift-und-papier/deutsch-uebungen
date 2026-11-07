import { describe, expect, it } from 'vitest'
import { neuNummerieren, ohneLoesung, teileZuText, textZuTeilen } from './lueckentext'

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

describe('Auswahl-Stellen', () => {
  it('erkennt Einfachauswahl mit *', () => {
    const { teile, fehler } = textZuTeilen('Ich weiß, [das | *dass] du kommst.')
    expect(fehler).toEqual([])
    expect(teile[1]).toEqual({ t: 'auswahl', id: 0, optionen: ['das', 'dass'], richtig: [1] })
  })

  it('erkennt Mehrfachauswahl', () => {
    const { teile } = textZuTeilen('Nomen? [*Hund | laufen | *Baum]')
    expect(teile[1]).toEqual({ t: 'auswahl', id: 0, optionen: ['Hund', 'laufen', 'Baum'], richtig: [0, 2] })
  })

  it('mischt Lücke und Auswahl mit fortlaufenden Nummern', () => {
    const { teile, fehler } = textZuTeilen('[Das] Kind, [das | dass*] lacht.'.replace('dass*', '*dass'))
    expect(fehler).toEqual([])
    expect(teile.filter((t) => t.t !== 'text').map((t) => [t.t, t.id])).toEqual([
      ['luecke', 0],
      ['auswahl', 1],
    ])
  })

  it('meldet fehlende Markierung und leere Möglichkeit', () => {
    expect(textZuTeilen('[das | dass]').fehler[0]).toContain('mit * markieren')
    expect(textZuTeilen('[*das | ]').fehler[0]).toContain('leer')
  })

  it('Hin- und Rückweg ergibt denselben Text', () => {
    const text = 'Ich weiß, [das | *dass] du [Rad fahren/radfahren] willst. [*Hund | laufen | *Baum]'
    expect(teileZuText(textZuTeilen(text).teile)).toBe(text)
  })

  it('Schüler-Inhalt enthält keine Lösung, nur das Mehrfach-Kennzeichen', () => {
    const inhalt = ohneLoesung(textZuTeilen('[das | *dass] [*a | b | *c] [Lösung]').teile)
    const json = JSON.stringify(inhalt)
    expect(json).not.toContain('richtig')
    expect(json).not.toContain('Lösung')
    expect(inhalt.teile.filter((t) => t.t === 'auswahl').map((t) => (t.t === 'auswahl' ? t.mehrfach : null))).toEqual([false, true])
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

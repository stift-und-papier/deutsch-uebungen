import { describe, expect, it } from 'vitest'
import { kategorienAus, neuNummerieren, ohneLoesung, reihenZuTeilen, teileZuText, textZuTeilen } from './lueckentext'

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

describe('Zuordnen', () => {
  const einheiten = (text: string) =>
    textZuTeilen(text, true).teile.flatMap((t) => (t.t === 'einheit' ? [[t.id, t.v, t.kategorie]] : []))

  it('macht markierte Einheiten und alle übrigen Wörter antippbar', () => {
    expect(einheiten('Der [Hund = Nomen] bellt.')).toEqual([
      [0, 'Der', null],
      [1, 'Hund', 'Nomen'],
      [2, 'bellt', null],
    ])
  })

  it('erlaubt Wortgruppen (Satzglieder) und behält Satzzeichen als Text', () => {
    const { teile, fehler } = textZuTeilen('[Der kleine Hund = Subjekt] [bellt = Prädikat], oder?', true)
    expect(fehler).toEqual([])
    expect(teile.map((t) => (t.t === 'text' ? `T:${t.v}` : t.t === 'einheit' ? `E:${t.v}` : '?'))).toEqual([
      'E:Der kleine Hund',
      'T: ',
      'E:bellt',
      'T:, ',
      'E:oder',
      'T:?',
    ])
  })

  it('erkennt Wörter mit Umlaut, Bindestrich und Apostroph als ein Wort', () => {
    expect(einheiten('Übermorgen fährt’s E-Bike.').map((e) => e[1])).toEqual(['Übermorgen', 'fährt’s', 'E-Bike'])
  })

  it('meldet fehlende Kategorie und Text ohne Markierung', () => {
    expect(textZuTeilen('[Hund = ]', true).fehler[0]).toContain('[Wort = Kategorie]')
    expect(textZuTeilen('Der Hund bellt.', true).fehler[0]).toContain('mindestens ein Wort')
  })

  it('Hin- und Rückweg ergibt denselben Text', () => {
    const text = 'Der [kleine Hund = Subjekt] [bellt = Prädikat] laut.'
    expect(teileZuText(textZuTeilen(text, true).teile)).toBe(text)
  })

  it('Kategorien: eingetragene zuerst, dann die aus dem Text, ohne Doppelte', () => {
    expect(kategorienAus(textZuTeilen('[Hund = Nomen] [rennt = Verb] [Baum = Nomen]', true).teile, ['Adjektiv', 'Nomen'])).toEqual([
      'Adjektiv',
      'Nomen',
      'Verb',
    ])
  })

  it('Schüler-Inhalt verrät die Kategorie nicht', () => {
    const inhalt = ohneLoesung(textZuTeilen('Der [Hund = Nomen] bellt.', true).teile, undefined, ['Nomen', 'Verb'])
    expect(JSON.stringify(inhalt.teile)).not.toContain('Nomen')
    expect(inhalt.kategorien).toEqual(['Nomen', 'Verb'])
  })
})

describe('Fehler finden', () => {
  const woerter = (text: string) =>
    textZuTeilen(text, 'fehler').teile.flatMap((t) => (t.t === 'wort' ? [[t.id, t.v, t.korrekturen]] : []))

  it('macht Fehlerwörter und alle übrigen Wörter (mit Satzzeichen) antippbar', () => {
    expect(woerter('Ich [weis -> weiß], dass du kommst.')).toEqual([
      [0, 'Ich', null],
      [1, 'weis', ['weiß']],
      [2, 'dass', null],
      [3, 'du', null],
      [4, 'kommst.', null],
    ])
  })

  it('lässt reine Satzzeichen hinter einer Klammer als Text stehen', () => {
    const { teile } = textZuTeilen('Er [kommt -> kommt.] .', 'fehler')
    expect(teile.filter((t) => t.t === 'wort').map((t) => (t.t === 'wort' ? t.v : ''))).toEqual(['Er', 'kommt'])
  })

  it('erlaubt mehrere Verbesserungen, Wortgruppen und Zeichensetzung', () => {
    expect(woerter('Wir [radfahren -> Rad fahren/radfahren]. Ich [weiß -> weiß,] es.').filter((w) => w[2])).toEqual([
      [1, 'radfahren', ['Rad fahren', 'radfahren']],
      [3, 'weiß', ['weiß,']],
    ])
  })

  it('meldet fehlende Verbesserung und Text ohne Fehler', () => {
    expect(textZuTeilen('Ich [weis -> ] es.', 'fehler').fehler[0]).toContain('[Fehlerwort -> Verbesserung]')
    expect(textZuTeilen('Ich weiß es.', 'fehler').fehler[0]).toContain('mindestens einen Fehler')
  })

  it('Hin- und Rückweg ergibt denselben Text', () => {
    const text = 'Ich [weis -> weiß] es [nich -> nicht/nich?]. Gut.'
    expect(teileZuText(textZuTeilen(text, 'fehler').teile)).toBe(text)
  })

  it('Schüler-Inhalt verrät weder Fehlerstellen noch Verbesserungen, nur die Anzahl', () => {
    const inhalt = ohneLoesung(textZuTeilen('Ich [weis -> weiß] es [nich -> nicht].', 'fehler').teile, undefined, undefined, {
      korrigieren: true,
      anzahl_zeigen: true,
    })
    const json = JSON.stringify(inhalt.teile)
    expect(json).not.toContain('weiß')
    expect(json).not.toContain('korrekturen')
    expect(inhalt.anzahl_fehler).toBe(2)
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

describe('Reihenfolge', () => {
  it('liest Bausteine, weitere Reihenfolgen und mehrere Sätze', () => {
    const { teile, fehler } = reihenZuTeilen(
      'Gestern | bin ich | ins Kino | gegangen.\nIns Kino | bin ich | gestern | gegangen.\n\nDer Hund | bellt.',
    )
    expect(fehler).toEqual([])
    expect(teile).toHaveLength(2)
    const [a, b] = teile
    if (a.t !== 'reihe' || b.t !== 'reihe') throw new Error('kein Satz')
    expect(a.id).toBe(0)
    expect(b.id).toBe(1)
    expect(a.bausteine.map((x) => x.v)).toEqual(['Gestern', 'bin ich', 'ins Kino', 'gegangen.'])
    expect(a.loesungen[1]).toEqual(['Ins Kino', 'bin ich', 'gestern', 'gegangen.'])
    // Kennungen eindeutig
    expect(new Set(a.bausteine.map((x) => x.k)).size).toBe(4)
  })

  it('mischt: nach Kennung sortiert ist die Reihenfolge nie die richtige', () => {
    for (let n = 0; n < 50; n++) {
      const { teile } = reihenZuTeilen('a | b | c')
      const t = teile[0]
      if (t.t !== 'reihe') throw new Error('kein Satz')
      const gemischt = ohneLoesung(teile).teile[0]
      if (gemischt.t !== 'reihe') throw new Error('kein Satz')
      expect(gemischt.bausteine.map((x) => x.v)).not.toEqual(['a', 'b', 'c'])
      expect(gemischt).not.toHaveProperty('loesungen')
    }
  })

  it('meldet Fehler in der Schreibweise', () => {
    expect(reihenZuTeilen('Nur ein Baustein').fehler[0]).toMatch(/mit \| trennen/)
    expect(reihenZuTeilen('a | b\nb | c').fehler[0]).toMatch(/dieselben Bausteine/)
    expect(reihenZuTeilen('').fehler[0]).toMatch(/mindestens einen Satz/)
    // Groß-/Kleinschreibung und Satzzeichen am Ende zählen beim Vergleich nicht
    expect(reihenZuTeilen('Gestern | kam er.\nEr kam | gestern').fehler[0]).toMatch(/dieselben/)
    expect(reihenZuTeilen('Gestern | kam er.\nkam er | gestern.').fehler).toEqual([])
  })

  it('wandelt zurück in die Schreibweise', () => {
    const text = 'a | b\nb | a\n\nc | d'
    expect(teileZuText(reihenZuTeilen(text).teile)).toBe(text)
  })
})

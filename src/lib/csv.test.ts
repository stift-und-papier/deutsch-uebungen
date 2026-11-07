import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { csvLesen, kompetenzenAusCsv } from './csv'

describe('csvLesen', () => {
  it('liest Felder mit Anführungszeichen und Semikolon darin', () => {
    expect(csvLesen('a;"b;c";d\r\n"x ""y""";;z')).toEqual([
      ['a', 'b;c', 'd'],
      ['x "y"', '', 'z'],
    ])
  })
})

describe('kompetenzenAusCsv mit docs/kompetenzen.csv', () => {
  const { zeilen, fehler } = kompetenzenAusCsv(readFileSync('docs/kompetenzen.csv', 'utf8'))

  it('liest alle 154 Kompetenzen ohne Fehler', () => {
    expect(fehler).toEqual([])
    expect(zeilen).toHaveLength(154)
  })

  it('verteilt sich auf die drei Kerncurricula', () => {
    const anzahl = (kc: string) => zeilen.filter((z) => z.kerncurriculum === kc).length
    expect(anzahl('Gymnasium') + anzahl('Realschule') + anzahl('Hauptschule')).toBe(154)
  })

  it('übernimmt Texte mit Semikolon vollständig', () => {
    const z = zeilen.find((k) => k.code === 'GYM-SA-8-02')
    expect(z?.kompetenz).toContain('Subjektsatz, Objektsatz, Adverbialsatz (Konjunktionalsatz); Attributsatz')
  })

  it('übernimmt Hinweise', () => {
    expect(zeilen.find((k) => k.code === 'GYM-TU-6-10-01')?.hinweis).toBe('Kompetenzbereich Schreiben; gilt über alle Stufen')
  })
})

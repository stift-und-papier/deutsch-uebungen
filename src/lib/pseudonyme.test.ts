import { describe, expect, it } from 'vitest'
import { erzeugePseudonyme, pseudonymListeLesen } from './pseudonyme'

describe('erzeugePseudonyme', () => {
  it('erzeugt die gewünschte Anzahl im Format Tier-Nummer', () => {
    const namen = erzeugePseudonyme(28, [])
    expect(namen).toHaveLength(28)
    for (const n of namen) expect(n).toMatch(/^[A-ZÄÖÜ][a-zäöü]+-\d{2}$/)
  })

  it('erzeugt keine Doppelten, auch nicht mit vorhandenen Namen', () => {
    const vorhanden = ['Fuchs-07', 'Eule-12']
    const namen = erzeugePseudonyme(60, vorhanden)
    const alle = [...vorhanden, ...namen].map((n) => n.toLowerCase())
    expect(new Set(alle).size).toBe(alle.length)
  })
})

describe('pseudonymListeLesen', () => {
  it('ignoriert Leerzeilen und meldet Doppelte', () => {
    const { neu, doppelt } = pseudonymListeLesen('Mond-1\n\n  Stern-2 \nmond-1\nSonne-3', ['Sonne-3'])
    expect(neu).toEqual(['Mond-1', 'Stern-2'])
    expect(doppelt).toEqual(['mond-1', 'Sonne-3'])
  })
})

import { describe, expect, it } from 'vitest'
import { naechsteSortierung, sortiere } from './sortierung'
import type { Aufgabe } from './typen'

type A = Pick<Aufgabe, 'titel' | 'typ' | 'schwierigkeit'>
const liste: A[] = [
  { titel: 'Kommas', typ: 'lueckentext', schwierigkeit: 'schwer' },
  { titel: 'das/dass', typ: 'auswahl', schwierigkeit: 'leicht' },
  { titel: 'Erklärung Komma', typ: 'erklaerung', schwierigkeit: 'mittel' },
  { titel: 'Adjektive', typ: 'zuordnen', schwierigkeit: 'mittel' },
  { titel: 'Aufgabe 10', typ: 'fehler', schwierigkeit: 'leicht' },
  { titel: 'Aufgabe 2', typ: 'fehler', schwierigkeit: 'leicht' },
]
const name = (t: string) => t
const titel = (l: A[]) => l.map((a) => a.titel)

describe('Sortierung der Aufgabenliste', () => {
  it('ohne Sortierung bleibt die Reihenfolge', () => {
    expect(sortiere(liste, null, name)).toBe(liste)
  })
  it('Titel A → Z, Zahlen natürlich, ohne Groß-/Kleinschreibung', () => {
    expect(titel(sortiere(liste, { spalte: 'titel', absteigend: false }, name))).toEqual([
      'Adjektive', 'Aufgabe 2', 'Aufgabe 10', 'das/dass', 'Erklärung Komma', 'Kommas',
    ])
  })
  it('Titel Z → A', () => {
    expect(titel(sortiere(liste, { spalte: 'titel', absteigend: true }, name))[0]).toBe('Kommas')
  })
  it('Stufe 1 → 2 → 3, nicht alphabetisch (leicht/mittel/schwer); Erklärseiten am Ende', () => {
    expect(titel(sortiere(liste, { spalte: 'stufe', absteigend: false }, name))).toEqual([
      'Aufgabe 2', 'Aufgabe 10', 'das/dass', 'Adjektive', 'Kommas', 'Erklärung Komma',
    ])
  })
  it('Stufe 3 → 1, Erklärseiten bleiben am Ende, Gleichstand nach Titel', () => {
    expect(titel(sortiere(liste, { spalte: 'stufe', absteigend: true }, name))).toEqual([
      'Kommas', 'Adjektive', 'Aufgabe 2', 'Aufgabe 10', 'das/dass', 'Erklärung Komma',
    ])
  })
  it('Format nach dem angezeigten Namen', () => {
    const anzeige = (t: string) => ({ fehler: 'Fehler finden', auswahl: 'Auswahl' })[t] ?? 'Z'
    expect(titel(sortiere(liste, { spalte: 'format', absteigend: false }, anzeige)).slice(0, 3)).toEqual([
      'das/dass', 'Aufgabe 2', 'Aufgabe 10',
    ])
  })
  it('Klick: gleiche Spalte dreht um, andere Spalte beginnt aufsteigend', () => {
    expect(naechsteSortierung(null, 'stufe')).toEqual({ spalte: 'stufe', absteigend: false })
    expect(naechsteSortierung({ spalte: 'stufe', absteigend: false }, 'stufe')).toEqual({ spalte: 'stufe', absteigend: true })
    expect(naechsteSortierung({ spalte: 'stufe', absteigend: true }, 'titel')).toEqual({ spalte: 'titel', absteigend: false })
  })
})

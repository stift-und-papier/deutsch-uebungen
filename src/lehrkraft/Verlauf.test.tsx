import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Auswertung, Einstellungen } from '../lib/lernstand'
import { Verlauf } from './LernstandAnzeige'

const e = { grenze_minus: 35, grenze_o: 55, grenze_plus: 70, grenze_plusplus: 85 } as Einstellungen

function auswertung(tage: number[]): Auswertung {
  return {
    verlauf: tage.map((t, i) => ({ zeit: new Date(2026, 9, t, 10).toISOString(), punkte: 20 + i * 5 })),
  } as Auswertung
}

describe('Verlauf', () => {
  it('beschriftet jeden Versuch mit Datum, wenn Platz ist', () => {
    const html = renderToStaticMarkup(<Verlauf a={auswertung([1, 5, 9, 14])} e={e} />)
    for (const d of ['01.10.', '05.10.', '09.10.', '14.10.']) expect(html).toContain(d)
  })

  it('zeigt bei 10 Versuchen alle Daten (versetzt in zwei Zeilen)', () => {
    const tage = Array.from({ length: 10 }, (_, i) => i * 2 + 1)
    const html = renderToStaticMarkup(<Verlauf a={auswertung(tage)} e={e} />)
    expect(html.match(/class="verlauf-datum"/g)?.length).toBe(10)
  })

  it('lässt erst bei sehr vielen Versuchen Daten aus, zeigt aber immer das letzte', () => {
    const tage = Array.from({ length: 30 }, (_, i) => i + 1)
    const html = renderToStaticMarkup(<Verlauf a={auswertung(tage)} e={e} />)
    const beschriftet = html.match(/class="verlauf-datum"/g)?.length ?? 0
    expect(beschriftet).toBeLessThan(30)
    expect(html).toContain('30.10.')
    // Jeder Punkt hat trotzdem sein volles Datum als Titel
    expect(html.match(/<title>/g)?.length).toBe(30)
  })
})

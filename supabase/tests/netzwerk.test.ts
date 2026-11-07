import { describe, expect, it } from 'vitest'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../src/lib/supabase'

// Prüft die Zugriffsregeln "von außen" – genau so, wie es jemand mit dem öffentlichen
// Schlüssel aus der App (z. B. über die Entwicklerwerkzeuge des Browsers) versuchen könnte.
// Läuft gegen die echte Datenbank, liest und schreibt aber nichts.

const kopf = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }

async function holen(pfad: string, optionen: RequestInit = {}) {
  const antwort = await fetch(`${SUPABASE_URL}${pfad}`, { ...optionen, headers: { ...kopf, ...optionen.headers } })
  return { status: antwort.status, text: await antwort.text() }
}

describe('Zugriff ohne Anmeldung über das Netzwerk', () => {
  const tabellen = ['klassen', 'schueler', 'aufgaben', 'pakete', 'paket_aufgaben', 'zuweisungen', 'versuche', 'loesung_angesehen']

  it.each(tabellen)('Tabelle %s ist nicht lesbar', async (tabelle) => {
    const { status } = await holen(`/rest/v1/${tabelle}?select=*`)
    expect([401, 403]).toContain(status)
  })

  it('in versuche kann man nicht direkt schreiben', async () => {
    const { status } = await holen('/rest/v1/versuche', { method: 'POST', body: '{}' })
    expect([401, 403]).toContain(status)
  })

  it.each(['pruefe_aufgabe', 'nur_loesung', 'schueler_zum_token', 'neuer_token', 'zugewiesene_aufgabe'])(
    'interne Funktion %s ist gesperrt',
    async (funktion) => {
      const { status } = await holen(`/rest/v1/rpc/${funktion}`, { method: 'POST', body: '{}' })
      expect(status).not.toBe(200)
    },
  )

  it('ein ausgedachter Token liefert nichts', async () => {
    const { status, text } = await holen('/rest/v1/rpc/schueler_start', {
      method: 'POST',
      body: JSON.stringify({ p_token: 'ausgedacht_aaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
    })
    expect(status).not.toBe(200)
    expect(text).toContain('nicht (mehr) gültig')
  })
})

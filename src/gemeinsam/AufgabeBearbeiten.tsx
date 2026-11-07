import { useState } from 'react'
import type { Pruefergebnis, SchuelerAufgabe } from '../lib/typen'
import { LueckentextAnzeige } from './LueckentextAnzeige'

export type PruefAntwort = { ergebnis: Pruefergebnis; rueckmeldung: string | null; versuche: number }

type Props = {
  aufgabe: SchuelerAufgabe
  /** Antworten prüfen. Gibt null zurück, wenn gerade kein Internet da ist (Antwort wird später gesendet). */
  pruefen: (antworten: Record<string, string>) => Promise<PruefAntwort | null>
  /** Lösung holen (erst nach 2 Versuchen erlaubt) */
  loesungHolen?: () => Promise<Record<number, string[]>>
  /** Zwischenstand merken (z. B. im Speicher des iPads) */
  startAntworten?: Record<string, string>
  onAntwortenGeaendert?: (antworten: Record<string, string>) => void
  weiter?: { text: string; ziel: () => void }
}

// Bearbeitung einer Aufgabe – für Schüler:innen und für die Vorschau der Lehrkraft.
export function AufgabeBearbeiten({ aufgabe, pruefen, loesungHolen, startAntworten, onAntwortenGeaendert, weiter }: Props) {
  const [antworten, setAntworten] = useState<Record<string, string>>(startAntworten ?? {})
  const [ergebnis, setErgebnis] = useState<PruefAntwort | null>(null)
  const [versuche, setVersuche] = useState(aufgabe.versuche)
  const [tippOffen, setTippOffen] = useState(false)
  const [loesungen, setLoesungen] = useState<Record<number, string[]> | null>(null)
  const [loesungAngesehen, setLoesungAngesehen] = useState(aufgabe.loesung_angesehen)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const luecken = aufgabe.inhalt.teile.filter((t) => t.t === 'luecke')
  const alleAusgefuellt = luecken.every((l) => (antworten[l.id] ?? '').trim() !== '')
  const allesRichtig = ergebnis?.ergebnis.richtig === true

  async function beimPruefen() {
    setBeschaeftigt(true)
    setMeldung(null)
    try {
      const antwort = await pruefen(antworten)
      if (antwort) {
        setErgebnis(antwort)
        setVersuche(antwort.versuche)
        // Die Eingaben bleiben stehen, damit man falsche Lücken verbessern kann.
      } else {
        setMeldung('Gerade ist kein Internet da. Deine Antwort ist gespeichert und wird geprüft, sobald die Verbindung wieder da ist.')
      }
    } catch (e) {
      setMeldung(e instanceof Error ? e.message : String(e))
    } finally {
      setBeschaeftigt(false)
    }
  }

  function beiEingabe(id: number, wert: string) {
    const neu = { ...antworten, [id]: wert }
    setAntworten(neu)
    onAntwortenGeaendert?.(neu)
    // Sobald eine orange Lücke geändert wird, verschwindet ihre Markierung.
    setErgebnis((alt) =>
      alt
        ? {
            ...alt,
            ergebnis: {
              ...alt.ergebnis,
              luecken: alt.ergebnis.luecken.filter((l) => l.richtig || l.id !== id),
            },
          }
        : alt,
    )
  }

  async function beimLoesungAnsehen() {
    if (!loesungHolen) return
    const ok = window.confirm(
      'Möchtest du dir die Lösung ansehen?\n\nDu kannst danach weiter üben. Diese Aufgabe zählt dann aber nicht mehr für deine Entwicklung.',
    )
    if (!ok) return
    try {
      setLoesungen(await loesungHolen())
      setLoesungAngesehen(true)
    } catch (e) {
      setMeldung(e instanceof Error ? e.message : String(e))
    }
  }

  const anzahlRichtig = ergebnis?.ergebnis.luecken.filter((l) => l.richtig).length ?? 0

  return (
    <section className="aufgabe">
      <h2>{aufgabe.titel}</h2>
      {aufgabe.anweisung && <p className="anweisung">{aufgabe.anweisung}</p>}

      {aufgabe.hinweis && (
        <div className="tipp">
          {tippOffen ? (
            <p>💡 {aufgabe.hinweis}</p>
          ) : (
            <button type="button" className="knopf leise" onClick={() => setTippOffen(true)}>
              💡 Tipp anzeigen
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (alleAusgefuellt && !beschaeftigt && !allesRichtig) void beimPruefen()
        }}
      >
        <LueckentextAnzeige
          inhalt={aufgabe.inhalt}
          antworten={antworten}
          onAntwort={beiEingabe}
          ergebnis={ergebnis?.ergebnis}
          loesungen={loesungen}
          gesperrt={allesRichtig}
        />

        {ergebnis && (
          <div className={allesRichtig ? 'rueckmeldung gut' : 'rueckmeldung weiter-ueben'} role="status">
            {allesRichtig ? (
              <p>
                <strong>Richtig! Gut gemacht.</strong>
              </p>
            ) : anzahlRichtig > 0 ? (
              <p>
                <strong>Schon {anzahlRichtig} von {luecken.length} Lücken richtig.</strong> Schau dir die Lücken mit ↻ noch einmal an.
              </p>
            ) : (
              <p>
                <strong>Das klappt noch nicht ganz.</strong> Lies den Satz noch einmal in Ruhe – du schaffst das!
              </p>
            )}
            {!allesRichtig && ergebnis.rueckmeldung && <p>💡 {ergebnis.rueckmeldung}</p>}
          </div>
        )}

        {meldung && (
          <p className="hinweis-box" role="alert">
            {meldung}
          </p>
        )}

        <div className="knopfleiste">
          {!allesRichtig && (
            <button type="submit" className="knopf haupt" disabled={!alleAusgefuellt || beschaeftigt}>
              {beschaeftigt ? 'Wird geprüft …' : 'Prüfen'}
            </button>
          )}
          {!allesRichtig && loesungHolen && versuche >= 2 && !loesungen && (
            <button type="button" className="knopf leise" onClick={beimLoesungAnsehen}>
              Lösung ansehen
            </button>
          )}
          {weiter && (allesRichtig || loesungen) && (
            <button type="button" className="knopf haupt" onClick={weiter.ziel}>
              {weiter.text}
            </button>
          )}
        </div>
        {!alleAusgefuellt && !allesRichtig && <p className="klein">Fülle alle Lücken aus, dann kannst du prüfen.</p>}
        {loesungAngesehen && !loesungen && <p className="klein">Du hast dir die Lösung schon einmal angesehen.</p>}
      </form>
    </section>
  )
}

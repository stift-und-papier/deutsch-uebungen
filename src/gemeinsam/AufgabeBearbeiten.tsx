import { useState } from 'react'
import { FORMAT_ICON, PixelIcon } from '../lib/icons'
import type { Antwort, Antworten, Pruefergebnis, SchuelerAufgabe } from '../lib/typen'
import { LueckentextAnzeige } from './LueckentextAnzeige'

export type PruefAntwort = { ergebnis: Pruefergebnis; rueckmeldung: string | null; versuche: number }

/** Kopfzeile der Aufgabe (nur in der Schüleransicht): Zurück, Ort im Paket, Fortschritt */
export type AufgabenKopf = { zurueck: string; ort: string; nr: number; gesamt: number }

type Props = {
  aufgabe: SchuelerAufgabe
  /** Antworten prüfen. Gibt null zurück, wenn gerade kein Internet da ist (Antwort wird später gesendet). */
  pruefen: (antworten: Antworten) => Promise<PruefAntwort | null>
  /** Lösung holen (erst nach 2 Versuchen erlaubt) */
  loesungHolen?: () => Promise<Record<number, string[]>>
  /** Zwischenstand merken (z. B. im Speicher des iPads) */
  startAntworten?: Antworten
  onAntwortenGeaendert?: (antworten: Antworten) => void
  weiter?: { text: string; ziel: () => void }
  kopf?: AufgabenKopf
}

// Bearbeitung einer Aufgabe – für Schüler:innen und für die Vorschau der Lehrkraft.
// Aufbau nach dem Entwurf „Aufgabe“: Kopfkarte, große Aufgabenkarte, rechts die Tipp-Karte.
export function AufgabeBearbeiten({ aufgabe, pruefen, loesungHolen, startAntworten, onAntwortenGeaendert, weiter, kopf }: Props) {
  const [antworten, setAntworten] = useState<Antworten>(startAntworten ?? {})
  const [ergebnis, setErgebnis] = useState<PruefAntwort | null>(null)
  const [versuche, setVersuche] = useState(aufgabe.versuche)
  const [tippOffen, setTippOffen] = useState(false)
  const [loesungen, setLoesungen] = useState<Record<number, string[]> | null>(null)
  const [loesungAngesehen, setLoesungAngesehen] = useState(aufgabe.loesung_angesehen)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  // Lücken und Auswahl müssen alle beantwortet sein; beim Zuordnen muss mindestens ein Wort markiert sein
  // (die übrigen Wörter dürfen unmarkiert bleiben – manche gehören zu keiner Kategorie).
  const luecken = aufgabe.inhalt.teile.filter((t) => t.t === 'luecke' || t.t === 'auswahl' || t.t === 'reihe')
  // Antippbare Einheiten (Zuordnen) und Wörter (Fehler finden): mindestens eins muss markiert sein
  const einheiten = aufgabe.inhalt.teile.filter((t) => t.t === 'einheit' || t.t === 'wort')
  const beantwortet = (id: number) => {
    const a = antworten[id]
    if (a === true) return true
    // Reihenfolge: alle Bausteine müssen in der Reihe liegen
    const reihe = aufgabe.inhalt.teile.find((t) => t.t === 'reihe' && t.id === id)
    if (reihe && reihe.t === 'reihe') return Array.isArray(a) && a.length === reihe.bausteine.length
    return Array.isArray(a) ? a.length > 0 : typeof a === 'string' && a.trim() !== ''
  }
  const alleAusgefuellt =
    luecken.every((l) => beantwortet(l.id)) && (einheiten.length === 0 || einheiten.some((e) => beantwortet(e.id)))
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

  function beiEingabe(id: number, wert: Antwort) {
    // Leere Antworten (gelöschte Eingabe, aufgehobene Markierung) ganz entfernen
    const neu: Antworten = { ...antworten, [id]: wert }
    if (wert === '' || wert === false || (Array.isArray(wert) && wert.length === 0)) delete neu[id]
    setAntworten(neu)
    onAntwortenGeaendert?.(neu)
    // Sobald eine markierte Lücke geändert wird, verschwindet ihre Markierung.
    setErgebnis((alt) =>
      alt
        ? {
            ...alt,
            ergebnis: {
              ...alt.ergebnis,
              // Reihenfolge: nach jeder Änderung verschwinden die ✓/↻ dieses Satzes
              luecken: alt.ergebnis.luecken.filter((l) => l.id !== id || (l.richtig && !l.positionen)),
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

  // Wie die Stellen heißen: „Lücke“, „Auswahl“ oder – gemischt – „Stelle“
  const arten = new Set<string>([...luecken, ...einheiten].map((l) => l.t))
  const wort = arten.has('reihe')
    ? { eins: 'Satz', viele: 'Bausteine' }
    : arten.has('wort')
    ? { eins: 'Wort', viele: 'Fehler' }
    : arten.has('einheit')
    ? { eins: 'Wort', viele: 'Zuordnungen' }
    : arten.size > 1 ? { eins: 'Stelle', viele: 'Stellen' } : arten.has('auswahl') ? { eins: 'Auswahl', viele: 'Antworten' } : { eins: 'Lücke', viele: 'Lücken' }

  // Rückmeldung in der Sprache des Design-Systems: klar, ermutigend, nie „falsch“.
  const nochmalNummern = ergebnis?.ergebnis.luecken.flatMap((l) => (!l.richtig && l.id !== null ? [l.id + 1] : [])) ?? []
  const anzahlRichtig = ergebnis?.ergebnis.luecken.filter((l) => l.richtig).length ?? 0
  const gezaehlt = ergebnis?.ergebnis.luecken.length ?? 0
  // Fehler finden: nicht gefundene Fehler kommen ohne Nummer zurück – es wird nur ihre Anzahl genannt
  const fehlend = ergebnis?.ergebnis.luecken.filter((l) => l.id === null).length ?? 0
  const falschMarkiert = ergebnis?.ergebnis.luecken.filter((l) => l.id !== null && !l.richtig).length ?? 0
  // Reihenfolge: gezählt werden die richtig liegenden Bausteine
  const plaetze = ergebnis?.ergebnis.luecken.flatMap((l) => l.positionen ?? []) ?? []
  const plaetzeRichtig = plaetze.filter(Boolean).length
  const nochmalTitel = arten.has('reihe')
    ? plaetzeRichtig > 0
      ? 'Fast! Schau bei den Bausteinen mit ↻ nochmal hin.'
      : 'Schau nochmal hin.'
    : arten.has('wort')
    ? 'Fast! Schau nochmal genau hin.'
    : anzahlRichtig === 0 || nochmalNummern.length === 0
      ? 'Schau nochmal hin.'
      : arten.has('einheit')
        ? 'Fast! Schau bei den Wörtern mit ↻ nochmal hin.'
      : `Fast! Schau bei ${wort.eins} ${nochmalNummern.slice(0, -1).join(', ')}${nochmalNummern.length > 1 ? ' und ' : ''}${nochmalNummern[nochmalNummern.length - 1]} nochmal hin.`
  const nochmalText = arten.has('reihe')
    ? ergebnis?.rueckmeldung ??
      (plaetzeRichtig > 0
        ? `Schon ${plaetzeRichtig} von ${plaetze.length} Bausteinen stehen an der richtigen Stelle.`
        : 'Lies den Satz laut: Was passt an den Anfang?')
    : arten.has('wort')
    ? [
        fehlend > 0 ? `Es fehlen noch ${fehlend} Fehler.` : '',
        falschMarkiert > 0 ? 'Bei den Wörtern mit ↻ stimmt etwas noch nicht.' : '',
        ergebnis?.rueckmeldung ?? '',
      ]
        .filter(Boolean)
        .join(' ')
    : ergebnis?.rueckmeldung ??
    (anzahlRichtig === 0
      ? 'Lies den Satz noch einmal in Ruhe – du schaffst das!'
      : `Schon ${anzahlRichtig} von ${gezaehlt} ${wort.viele} stimmen.`)

  const mitTipp = Boolean(aufgabe.hinweis)

  return (
    <section className="aufgabe">
      <header className="aes-card aufgabe-kopf">
        {kopf && (
          <a className="aes-btn aes-btn--secondary" href={kopf.zurueck}>
            Zurück
          </a>
        )}
        <div className="aufgabe-kopf__mitte" style={kopf ? undefined : { gridColumn: '1 / -1' }}>
          <PixelIcon name={FORMAT_ICON[aufgabe.typ]} groesse="l" />
          <div>
            {kopf && <p className="aufgabe-kopf__ort">{kopf.ort}</p>}
            <h1 className="aufgabe-kopf__titel">{aufgabe.titel}</h1>
          </div>
        </div>
        {kopf && (
          <div className="fortschritt">
            <p className="fortschritt__text">
              Aufgabe {kopf.nr} von {kopf.gesamt}
            </p>
            <div className="fortschritt__spur" aria-hidden="true">
              <div className="fortschritt__balken" style={{ width: `${(kopf.nr / kopf.gesamt) * 100}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className={mitTipp && tippOffen ? 'aufgabe-raster' : 'aufgabe-raster aufgabe-raster--einspaltig'}>
        <form
          className="aes-card aufgabe-hauptkarte"
          onSubmit={(e) => {
            e.preventDefault()
            if (alleAusgefuellt && !beschaeftigt && !allesRichtig) void beimPruefen()
          }}
        >
          {aufgabe.anweisung && <p className="aufgabe-anweisung">{aufgabe.anweisung}</p>}

          <LueckentextAnzeige
            inhalt={aufgabe.inhalt}
            antworten={antworten}
            onAntwort={beiEingabe}
            ergebnis={ergebnis?.ergebnis}
            loesungen={loesungen}
            gesperrt={allesRichtig}
          />

          {ergebnis &&
            (allesRichtig ? (
              <div className="aes-fb aes-fb--ok" role="status">
                <span className="aes-fb__icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <span className="aes-fb__title">Richtig! Gut gemacht.</span>
                  Alle {wort.viele} stimmen.
                </div>
              </div>
            ) : (
              <div className="aes-fb aes-fb--again" role="status">
                <span className="aes-fb__icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <span className="aes-fb__title">{nochmalTitel}</span>
                  {nochmalText}
                </div>
              </div>
            ))}

          {meldung && (
            <p className="hinweis-box" role="alert">
              {meldung}
            </p>
          )}

          <div className="aufgabe-fuss">
            {mitTipp && (
              <button type="button" className="aes-btn aes-btn--soft" onClick={() => setTippOffen(!tippOffen)} aria-expanded={tippOffen}>
                {tippOffen ? 'Tipp ausblenden' : 'Tipp anzeigen'}
              </button>
            )}
            <div className="aufgabe-fuss__rechts">
              {!allesRichtig && loesungHolen && versuche >= 2 && !loesungen && (
                <button type="button" className="aes-btn aes-btn--ghost" onClick={beimLoesungAnsehen}>
                  Lösung ansehen
                </button>
              )}
              {!allesRichtig && (
                <button
                  type="submit"
                  className={weiter && loesungen ? 'aes-btn aes-btn--secondary' : 'aes-btn aes-btn--primary'}
                  disabled={!alleAusgefuellt || beschaeftigt}
                >
                  {beschaeftigt ? 'Wird geprüft …' : ergebnis ? 'Nochmal prüfen' : 'Prüfen'}
                </button>
              )}
              {weiter && (allesRichtig || loesungen) && (
                <button type="button" className="aes-btn aes-btn--primary" onClick={weiter.ziel}>
                  {weiter.text}
                </button>
              )}
            </div>
          </div>
          {!alleAusgefuellt && !allesRichtig && <p className="aes-card__hint">
              {arten.has('reihe')
                ? 'Lege alle Bausteine in die Reihe'
                : arten.has('wort')
                ? 'Tippe die Fehlerwörter an'
                : arten.has('einheit')
                ? 'Markiere die passenden Wörter'
                : arten.has('luecke')
                  ? 'Fülle alles aus'
                  : 'Wähle überall eine Antwort'}
              , dann kannst du prüfen.
            </p>}
          {loesungAngesehen && !loesungen && <p className="aes-card__hint">Du hast dir die Lösung schon einmal angesehen.</p>}
        </form>

        {mitTipp && tippOffen && (
          <aside className="aes-card" aria-label="Tipp">
            <h2 className="aes-card__title">Tipp</h2>
            <p style={{ margin: 0 }}>{aufgabe.hinweis}</p>
          </aside>
        )}
      </div>
    </section>
  )
}

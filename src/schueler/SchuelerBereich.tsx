import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AufgabeBearbeiten } from '../gemeinsam/AufgabeBearbeiten'
import { fehlerText, istNetzwerkfehler } from '../lib/fehler'
import { gehe } from '../lib/router'
import { supabase } from '../lib/supabase'
import type { AbgabeAntwort, Loesung, SchuelerStart } from '../lib/typen'
import { neueId } from '../lib/zufall'
import { Entwicklung } from './Entwicklung'
import {
  entwurfLesen,
  entwurfSpeichern,
  warteschlangeLesen,
  warteschlangeSpeichern,
  type WartenderVersuch,
} from './speicher'

type Props = { token: string; pfad: string[] }

const STUFEN_TEXT = { leicht: 'leichte Stufe', mittel: 'mittlere Stufe', schwer: 'schwere Stufe' } as const

// Alles, was Schüler:innen sehen. Zugriff nur über die Datenbank-Funktionen mit dem Link-Token.
export function SchuelerBereich({ token, pfad }: Props) {
  const [daten, setDaten] = useState<SchuelerStart | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [wartend, setWartend] = useState(() => warteschlangeLesen(token).length)

  const laden = useCallback(async () => {
    const { data, error } = await supabase.rpc('schueler_start', { p_token: token })
    if (error) setFehler(fehlerText(error))
    else {
      setDaten(data as SchuelerStart)
      setFehler(null)
    }
  }, [token])

  // Wartende Antworten senden, sobald wieder Internet da ist.
  const warteschlangeSenden = useCallback(async () => {
    const liste = warteschlangeLesen(token)
    if (liste.length === 0) return
    const rest: WartenderVersuch[] = []
    for (const v of liste) {
      const { error } = await supabase.rpc('antwort_abgeben', {
        p_token: token,
        p_paket_id: v.paket_id,
        p_aufgabe_id: v.aufgabe_id,
        p_antworten: v.antworten,
        p_client_id: v.client_id,
        p_bearbeitet_am: v.bearbeitet_am,
      })
      // Nur bei Netzwerkproblemen behalten; andere Fehler (z. B. Aufgabe gelöscht) verwerfen.
      if (error && istNetzwerkfehler(error)) rest.push(v)
    }
    warteschlangeSpeichern(token, rest)
    setWartend(rest.length)
    if (rest.length < liste.length) void laden()
  }, [token, laden])

  useEffect(() => {
    void laden()
    void warteschlangeSenden()
    const beiOnline = () => void warteschlangeSenden()
    window.addEventListener('online', beiOnline)
    const timer = window.setInterval(() => void warteschlangeSenden(), 20000)
    return () => {
      window.removeEventListener('online', beiOnline)
      window.clearInterval(timer)
    }
  }, [laden, warteschlangeSenden])

  if (fehler && !daten) {
    return (
      <div className="wiese">
        <main className="seite schmal">
          <div className="aes-card">
            <h1>Hallo!</h1>
            <p className="hinweis-box">{fehler}</p>
            <p>Wenn das Problem bleibt, frag deine Lehrkraft nach deinem Link.</p>
            <button className="aes-btn aes-btn--primary" onClick={() => void laden()}>
              Noch einmal versuchen
            </button>
          </div>
        </main>
      </div>
    )
  }
  if (!daten)
    return (
      <div className="wiese">
        <main className="seite schmal">
          <p className="aes-card">Einen Moment …</p>
        </main>
      </div>
    )

  const basis = `/s/${token}`
  const [bereich, paketId, , aufgabeId] = pfad
  const paket = bereich === 'p' ? daten.pakete.find((p) => p.id === paketId) : undefined
  const geschafftGesamt = daten.pakete.reduce((summe, p) => summe + p.aufgaben.filter((a) => a.geloest).length, 0)

  const wartendHinweis = wartend > 0 && (
    <p className="hinweis-box" role="status">
      {wartend === 1 ? '1 Antwort wartet' : `${wartend} Antworten warten`} auf Internet und wird automatisch gesendet.
    </p>
  )

  // Übersichtsseiten: Seitenleiste + Inhalt auf Karten (Entwurf „Mein Lernweg“)
  if (!(paket && aufgabeId)) {
    return (
      <SchuelerRahmen basis={basis} pseudonym={daten.pseudonym} aktiv={bereich === 'entwicklung' ? 'lernweg' : 'uebungen'}>
        {wartendHinweis}

        {bereich === 'entwicklung' && (
          <Entwicklung token={token} pseudonym={daten.pseudonym} geschafft={geschafftGesamt} uebungen={`#${basis}`} />
        )}

        {!paket && bereich !== 'entwicklung' && (
          <>
            <header className="aes-card seitenkopf">
              <div>
                <h1 className="titel-gross">Hallo {daten.pseudonym}!</h1>
                <p className="seitenkopf__text">
                  {daten.pakete.length === 0 ? 'Für dich gibt es gerade keine Übungen. Schau später noch einmal vorbei.' : 'Such dir eine Übung aus.'}
                </p>
              </div>
            </header>
            <ul className="karten-raster">
              {daten.pakete.map((p) => {
                const geschafft = p.aufgaben.filter((a) => a.geloest).length
                const fertig = geschafft === p.aufgaben.length && p.aufgaben.length > 0
                return (
                  <li key={p.id}>
                    <a className="aes-card karten-link" href={`#${basis}/p/${p.id}`}>
                      <h2 className="aes-card__title">{p.titel}</h2>
                      {p.beschreibung && <p className="aes-card__hint">{p.beschreibung}</p>}
                      <p className="karten-link__stand">
                        {fertig ? '✓ Alle Aufgaben geschafft' : `${geschafft} von ${p.aufgaben.length} Aufgaben geschafft`}
                      </p>
                      <div className="fortschritt__spur" aria-hidden="true">
                        <div
                          className="fortschritt__balken"
                          style={{ width: `${p.aufgaben.length ? (geschafft / p.aufgaben.length) * 100 : 0}%` }}
                        />
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {paket && (
          <>
            <header className="aes-card seitenkopf">
              <a className="aes-btn aes-btn--secondary" href={`#${basis}`}>
                Zurück
              </a>
              <div>
                <h1>{paket.titel}</h1>
                {paket.beschreibung && <p className="seitenkopf__text">{paket.beschreibung}</p>}
              </div>
            </header>
            <ol className="karten-liste">
              {paket.aufgaben.map((a, i) => (
                <li key={a.id}>
                  <a className="aes-card karten-link karten-link--zeile" href={`#${basis}/p/${paket.id}/a/${a.id}`}>
                    <span className="karten-link__nr" aria-hidden="true">
                      {a.geloest ? '✓' : i + 1}
                    </span>
                    <span>
                      <strong className="karten-link__titel">{a.titel}</strong>
                      <span className="aes-card__hint">
                        {a.geloest ? 'Geschafft – du kannst sie noch einmal üben.' : a.versuche > 0 ? 'Angefangen' : 'Neu'}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </>
        )}
      </SchuelerRahmen>
    )
  }

  // Aufgabenseite (Entwurf „Aufgabe“): ganze Breite, Wiese als Hintergrund, Inhalte auf Karten
  return (
    <div className="wiese">
    <main className="seite breit">
      {wartendHinweis}

      {paket && aufgabeId && (() => {
        const index = paket.aufgaben.findIndex((a) => a.id === aufgabeId)
        const aufgabe = paket.aufgaben[index]
        if (!aufgabe) return <p>Diese Aufgabe gibt es nicht mehr.</p>
        const naechste = paket.aufgaben[index + 1]
        return (
          <>
            <AufgabeBearbeiten
              key={aufgabe.id}
              aufgabe={aufgabe}
              kopf={{
                zurueck: `#${basis}/p/${paket.id}`,
                ort: `${paket.titel} · ${STUFEN_TEXT[aufgabe.schwierigkeit]}`,
                nr: index + 1,
                gesamt: paket.aufgaben.length,
              }}
              startAntworten={entwurfLesen(token, aufgabe.id)}
              onAntwortenGeaendert={(antworten) => entwurfSpeichern(token, aufgabe.id, antworten)}
              pruefen={async (antworten) => {
                const versuch: WartenderVersuch = {
                  client_id: neueId(),
                  paket_id: paket.id,
                  aufgabe_id: aufgabe.id,
                  antworten,
                  bearbeitet_am: new Date().toISOString(),
                }
                const { data, error } = await supabase.rpc('antwort_abgeben', {
                  p_token: token,
                  p_paket_id: versuch.paket_id,
                  p_aufgabe_id: versuch.aufgabe_id,
                  p_antworten: versuch.antworten,
                  p_client_id: versuch.client_id,
                  p_bearbeitet_am: versuch.bearbeitet_am,
                })
                if (error) {
                  if (istNetzwerkfehler(error)) {
                    const liste = [...warteschlangeLesen(token), versuch]
                    warteschlangeSpeichern(token, liste)
                    setWartend(liste.length)
                    return null
                  }
                  throw new Error(fehlerText(error))
                }
                const antwort = data as AbgabeAntwort
                if (antwort.ergebnis.richtig) {
                  entwurfSpeichern(token, aufgabe.id, null)
                  void laden()
                }
                return antwort
              }}
              loesungHolen={async () => {
                const { data, error } = await supabase.rpc('loesung_anzeigen', {
                  p_token: token,
                  p_paket_id: paket.id,
                  p_aufgabe_id: aufgabe.id,
                })
                if (error) throw new Error(fehlerText(error))
                const loesung = data as Loesung
                return Object.fromEntries(loesung.luecken.map((l) => [l.id, l.loesungen]))
              }}
              weiter={
                naechste
                  ? { text: 'Weiter', ziel: () => gehe(`${basis}/p/${paket.id}/a/${naechste.id}`) }
                  : { text: 'Fertig', ziel: () => gehe(`${basis}/p/${paket.id}`) }
              }
            />
          </>
        )
      })()}
    </main>
    </div>
  )
}

// Rahmen der Übersichtsseiten: schulblaue Seitenleiste (aes-nav) mit Platz fürs Schullogo.
// Auf dem iPad im Hochformat wird die Leiste zu einer Leiste am unteren Rand.
function SchuelerRahmen({
  basis,
  pseudonym,
  aktiv,
  children,
}: {
  basis: string
  pseudonym: string
  aktiv: 'uebungen' | 'lernweg'
  children: ReactNode
}) {
  return (
    <div className="wiese rahmen">
      <nav className="aes-nav rahmen__nav" aria-label="Hauptmenü">
        <div className="logo-platz" aria-hidden="true" />
        <div className="aes-nav__brand">Übungswiese</div>
        <a className="aes-nav__item" href={`#${basis}`} aria-current={aktiv === 'uebungen' ? 'page' : undefined}>
          <span className="aes-nav__dot" aria-hidden="true" />
          Meine Übungen
        </a>
        <a className="aes-nav__item" href={`#${basis}/entwicklung`} aria-current={aktiv === 'lernweg' ? 'page' : undefined}>
          <span className="aes-nav__dot" aria-hidden="true" />
          Mein Lernweg
        </a>
        <div className="rahmen__name">
          <span className="rahmen__punkt" aria-hidden="true" />
          {pseudonym}
        </div>
      </nav>
      <main className="rahmen__inhalt">{children}</main>
    </div>
  )
}

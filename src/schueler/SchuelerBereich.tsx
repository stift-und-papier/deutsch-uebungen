import { useCallback, useEffect, useState } from 'react'
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
      <main className="seite schueler">
        <h1>Hallo!</h1>
        <p className="hinweis-box">{fehler}</p>
        <p>Wenn das Problem bleibt, frag deine Lehrkraft nach deinem Link.</p>
        <button className="knopf" onClick={() => void laden()}>
          Noch einmal versuchen
        </button>
      </main>
    )
  }
  if (!daten) return <main className="seite schueler"><p>Einen Moment …</p></main>

  const basis = `/s/${token}`
  const [bereich, paketId, , aufgabeId] = pfad
  const paket = bereich === 'p' ? daten.pakete.find((p) => p.id === paketId) : undefined

  return (
    <main className="seite schueler">
      {wartend > 0 && (
        <p className="hinweis-box">
          {wartend === 1 ? '1 Antwort wartet' : `${wartend} Antworten warten`} auf Internet und wird automatisch gesendet.
        </p>
      )}

      {bereich === 'entwicklung' && <Entwicklung token={token} zurueck={`#${basis}`} />}

      {!paket && bereich !== 'entwicklung' && (
        <>
          <h1>Hallo {daten.pseudonym}!</h1>
          <div className="knopfleiste">
            <a className="knopf" href={`#${basis}/entwicklung`}>
              🌱 Meine Entwicklung
            </a>
          </div>
          {daten.pakete.length === 0 ? (
            <p>Für dich gibt es gerade keine Übungen. Schau später noch einmal vorbei.</p>
          ) : (
            <>
              <p>Such dir eine Übung aus:</p>
              <ul className="kachelliste">
                {daten.pakete.map((p) => {
                  const geschafft = p.aufgaben.filter((a) => a.geloest).length
                  return (
                    <li key={p.id}>
                      <a className="kachel" href={`#${basis}/p/${p.id}`}>
                        <strong>{p.titel}</strong>
                        {p.beschreibung && <span>{p.beschreibung}</span>}
                        <span className="klein">
                          {geschafft === p.aufgaben.length && p.aufgaben.length > 0
                            ? '✓ Alle Aufgaben geschafft'
                            : `${geschafft} von ${p.aufgaben.length} Aufgaben geschafft`}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}

      {paket && !aufgabeId && (
        <>
          <a className="zurueck" href={`#${basis}`}>
            ← Alle Übungen
          </a>
          <h1>{paket.titel}</h1>
          {paket.beschreibung && <p>{paket.beschreibung}</p>}
          <ol className="kachelliste">
            {paket.aufgaben.map((a) => (
              <li key={a.id}>
                <a className="kachel" href={`#${basis}/p/${paket.id}/a/${a.id}`}>
                  <strong>
                    {a.geloest ? '✓ ' : ''}
                    {a.titel}
                  </strong>
                  <span className="klein">{a.geloest ? 'geschafft – du kannst sie noch einmal üben' : a.versuche > 0 ? 'angefangen' : 'neu'}</span>
                </a>
              </li>
            ))}
          </ol>
        </>
      )}

      {paket && aufgabeId && (() => {
        const index = paket.aufgaben.findIndex((a) => a.id === aufgabeId)
        const aufgabe = paket.aufgaben[index]
        if (!aufgabe) return <p>Diese Aufgabe gibt es nicht mehr.</p>
        const naechste = paket.aufgaben[index + 1]
        return (
          <>
            <a className="zurueck" href={`#${basis}/p/${paket.id}`}>
              ← {paket.titel}
            </a>
            <p className="klein">
              Aufgabe {index + 1} von {paket.aufgaben.length}
            </p>
            <AufgabeBearbeiten
              key={aufgabe.id}
              aufgabe={aufgabe}
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
                  ? { text: 'Nächste Aufgabe →', ziel: () => gehe(`${basis}/p/${paket.id}/a/${naechste.id}`) }
                  : { text: 'Zurück zur Übersicht', ziel: () => gehe(`${basis}/p/${paket.id}`) }
              }
            />
          </>
        )
      })()}
    </main>
  )
}

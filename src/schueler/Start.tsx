import { useEffect, useState } from 'react'
import { Blumenwiese, wieseSatz } from '../gemeinsam/Blumenwiese'
import { Sterne } from '../gemeinsam/Sterne'
import { PixelIcon } from '../lib/icons'
import { supabase } from '../lib/supabase'
import type { SchuelerStart } from '../lib/typen'

// Startseite der Schüler:innen (Entwurf „Start mit Blumenwiese“): Begrüßung, Blumenwiese, nächster Schritt.
// Die Blumenzahl berechnet der Server (schueler_wiese) – hier kommt nur diese eine Zahl an, keine Stufen.

const SCHLUESSEL = (token: string) => `wiese_gesehen:${token}`

function gesehenLesen(token: string) {
  try {
    return Number(localStorage.getItem(SCHLUESSEL(token))) || 0
  } catch {
    return 0
  }
}

type Props = { token: string; daten: SchuelerStart; geschafft: number; basis: string }

export function Start({ token, daten, geschafft, basis }: Props) {
  const [blumen, setBlumen] = useState<number | null>(null)
  // Blumen vom letzten Besuch blühen nicht noch einmal auf
  const [bisher] = useState(() => gesehenLesen(token))

  useEffect(() => {
    void supabase.rpc('schueler_wiese', { p_token: token }).then(({ data, error }) => {
      // Ohne Internet: die zuletzt gesehene Wiese zeigen (sie welkt ja nie)
      const zahl = error ? gesehenLesen(token) : Number((data as { blumen: number }).blumen) || 0
      setBlumen(zahl)
      try {
        localStorage.setItem(SCHLUESSEL(token), String(zahl))
      } catch {
        /* privates Surfen: dann blühen eben alle noch einmal auf */
      }
    })
  }, [token])

  // Nächster Schritt: erste noch nicht gelöste Aufgabe im neuesten Paket
  const paket = daten.pakete.find((p) => p.aufgaben.some((a) => !a.geloest))
  const aufgabe = paket?.aufgaben.find((a) => !a.geloest)

  return (
    <>
      <header className="aes-card seitenkopf">
        <div>
          <h1 className="titel-gross">Hallo {daten.pseudonym}!</h1>
          <p className="seitenkopf__text">Schön, dass du wieder da bist.</p>
        </div>
        <div className="zaehler zaehler--mit-icon">
          <PixelIcon name="stern" groesse="m" />
          <span>
            <span className="zaehler__zahl">{geschafft}</span>
            <span className="zaehler__text">{geschafft === 1 ? 'Übung geschafft' : 'Übungen geschafft'}</span>
          </span>
        </div>
      </header>

      <section className="aes-card wiese-karte">
        {blumen === null ? (
          <div className="wiese-karte__platzhalter" aria-hidden="true" />
        ) : (
          <Blumenwiese blumen={blumen} bisher={bisher} />
        )}
        <div className="wiese-karte__text">
          <h2 className="aes-card__title icon-titel">
            <PixelIcon name="blume" />
            Deine Blumenwiese
          </h2>
          <p className="seitenkopf__text">
            {blumen === null ? 'Einen Moment …' : `${wieseSatz(blumen)} Mit jeder Übung wächst sie weiter.`}
          </p>
        </div>
      </section>

      <section className="aes-card naechster-schritt">
        <PixelIcon name="paket" groesse="m" />
        <div>
          <h2 className="aes-card__title">Dein nächster Schritt</h2>
          <p className="seitenkopf__text">
            {paket ? `Übungspaket „${paket.titel}“.` : daten.pakete.length ? 'Du hast alle Aufgaben geschafft. Super!' : 'Gerade gibt es keine Übungen für dich.'}
          </p>
          {aufgabe && aufgabe.typ !== 'erklaerung' && (
            <p className="seitenkopf__text">
              {aufgabe.titel} <Sterne stufe={aufgabe.stufe} />
            </p>
          )}
        </div>
        {paket && aufgabe ? (
          <a className="aes-btn aes-btn--primary" href={`#${basis}/p/${paket.id}/a/${aufgabe.id}`}>
            Weiter üben
          </a>
        ) : (
          <a className="aes-btn aes-btn--secondary" href={`#${basis}/uebungen`}>
            Meine Übungen
          </a>
        )}
      </section>

      <section className="aes-card naechster-schritt">
        <PixelIcon name="fragezeichen" groesse="m" />
        <div>
          <h2 className="aes-card__title">Hilfe & Antworten</h2>
          <p className="seitenkopf__text">Was bedeuten die Sterne? Wer sieht meine Antworten? Hier findest du Antworten.</p>
        </div>
        <a className="aes-btn aes-btn--secondary" href={`#${basis}/hilfe`}>
          Hilfe öffnen
        </a>
      </section>
    </>
  )
}

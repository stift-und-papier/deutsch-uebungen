import { fettTeile, hilfeLesen, type Block } from '../lib/hilfe'
import { PixelIcon } from '../lib/icons'
import text from './hilfe.md?raw'

// Seite „Hilfe & Antworten“. Die Texte stehen in hilfe.md (ohne Code änderbar); alle Einträge starten zugeklappt.
const ABSCHNITTE = hilfeLesen(text)

const mitFett = (t: string) => fettTeile(t).map((teil, i) => (i % 2 ? <strong key={i}>{teil}</strong> : teil))

function BlockAnzeige({ block }: { block: Block }) {
  if (block.art === 'absatz') return <p>{mitFett(block.text)}</p>
  return (
    <ul>
      {block.punkte.map((p, i) => (
        <li key={i}>{mitFett(p)}</li>
      ))}
    </ul>
  )
}

export function Hilfe({ start }: { start: string }) {
  return (
    <>
      <header className="aes-card seitenkopf">
        <a className="aes-btn aes-btn--secondary" href={start}>
          Zurück zum Start
        </a>
        <div>
          <h1 className="titel-gross icon-titel">
            <PixelIcon name="fragezeichen" groesse="m" />
            Hilfe & Antworten
          </h1>
          <p className="seitenkopf__text">Tippe auf eine Frage, dann klappt die Antwort auf.</p>
        </div>
      </header>
      {ABSCHNITTE.map((a) => (
        <section key={a.titel} className="aes-card hilfe-abschnitt">
          <h2 className="aes-card__title">{a.titel}</h2>
          {a.eintraege.map((e) => (
            // Gleiche Klappen wie „Mein Lernweg“ (lernweg-erste)
            <details key={e.frage} className="lernweg-erste hilfe-eintrag">
              <summary className="lernweg-erste__knopf">{e.frage}</summary>
              {e.bloecke.map((b, i) => (
                <BlockAnzeige key={i} block={b} />
              ))}
            </details>
          ))}
        </section>
      ))}
    </>
  )
}

import { FORMAT_ICON, PixelIcon } from '../lib/icons'
import type { AufgabenTyp } from '../lib/typen'
import { FORMATE } from './AufgabeEditor'

// „+ Neue Aufgabe“: anklickbare Kacheln je Aufgabenformat (Icon, ein Satz, Mini-Beispiel).
export function FormatWahl() {
  return (
    <>
      <a className="aes-btn aes-btn--ghost zurueck" href="#/lehrkraft/aufgaben">
        ← Alle Aufgaben
      </a>
      <h1>Neue Aufgabe</h1>
      <p>Welches Format soll die Aufgabe haben? Sie können es beim Erstellen noch ändern.</p>
      <ul className="format-kacheln">
        {(Object.keys(FORMATE) as AufgabenTyp[]).map((typ) => (
          <li key={typ}>
            <a className="format-kachel" href={`#/lehrkraft/aufgaben/neu-${typ}`}>
              <PixelIcon name={FORMAT_ICON[typ]} groesse="m" />
              <span className="format-kachel__text">
                <span className="format-kachel__name">{FORMATE[typ].name}</span>
                <span className="format-kachel__kurz">{FORMATE[typ].kurz}</span>
                <span className="format-kachel__mini">{FORMATE[typ].mini}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

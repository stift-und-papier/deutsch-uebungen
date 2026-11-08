import { PixelIcon } from '../lib/icons'
import type { Stufe } from '../lib/typen'

// Stufe als Pixel-Sterne: gefüllt = erreicht/aktuell, leer = noch nicht. Für Screenreader „Stufe n von 3“.
// Nie mit Wertung (kein „leicht“, „schwer“ …) – die Sterne sind nur die Stufe.
export function Sterne({ stufe }: { stufe: Stufe }) {
  return (
    <span className="sterne" role="img" aria-label={`Stufe ${stufe} von 3`}>
      {[1, 2, 3].map((n) => (
        <PixelIcon key={n} name={n <= stufe ? 'stern' : 'stern-leer'} />
      ))}
    </span>
  )
}

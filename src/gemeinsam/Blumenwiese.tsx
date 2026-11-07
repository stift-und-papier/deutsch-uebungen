import { useEffect, useRef, useState } from 'react'
import slots from '../design/wiese/slots.json'

// Blumenwiese (Design-System, Baustein Blumenwiese): Pixel-Szene 220 × 100 mit bis zu 80 festen Blumenplätzen.
// Platz i blüht, wenn blumen > i. Die nächsten (bis zu 5) Plätze zeigen eine Sprosse: „Hier kommt bald etwas.“
// Keine Zahl und kein Text auf dem Bild – der Satz steht unter der Szene (siehe wieseSatz).

type Platz = { order: number; x: number; y: number; kind: string; size: 'S' | 'M' | 'L' }
const PLAETZE = [...(slots.plaetze as Platz[])].sort((a, b) => a.order - b.order)
const BREITE = slots.szene.breite
const HOEHE = slots.szene.hoehe
export const WIESE_MAX = PLAETZE.length
const SPROSSEN = 5

// Satz unter der Szene (Texte aus dem Design-System)
export function wieseSatz(blumen: number) {
  if (blumen <= 9) return 'Deine Wiese fängt gerade an zu blühen.'
  if (blumen <= 39) return 'Auf deiner Wiese blüht es schon an vielen Stellen.'
  return 'Deine Wiese blüht bunt!'
}

type Props = {
  blumen: number
  // Wie viele Blumen schon beim letzten Besuch da waren – nur die neuen blühen einmal auf.
  bisher?: number
}

export function Blumenwiese({ blumen, bisher = 0 }: Props) {
  const zahl = Math.max(0, Math.min(WIESE_MAX, Math.floor(blumen)))
  const rahmen = useRef<HTMLDivElement>(null)
  // Anzeige nur in ganzzahligen Vielfachen (2×, 3×, 4×), damit die Pixel scharf bleiben
  const [faktor, setFaktor] = useState(3)

  useEffect(() => {
    const el = rahmen.current
    if (!el) return
    const messen = () => setFaktor(Math.max(1, Math.min(4, Math.floor(el.clientWidth / BREITE))))
    messen()
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  const sprossen = PLAETZE.slice(zahl, zahl + SPROSSEN)
  const lage = (p: Platz) => ({
    left: `${((p.x / BREITE) * 100).toFixed(3)}%`,
    top: `${(((p.y + 1) / HOEHE) * 100).toFixed(3)}%`,
    zIndex: p.y,
  })

  return (
    <div ref={rahmen} className="wiese-rahmen">
      <div
        className="aes-wiese"
        role="img"
        aria-label="Deine Blumenwiese"
        style={{ width: BREITE * faktor, height: HOEHE * faktor }}
      >
        <div className="aes-wiese__szene" />
        {PLAETZE.slice(0, zahl).map((p, i) => (
          <span
            key={p.order}
            className={`aes-wiese__blume fl-${p.kind}-${p.size}${i < bisher ? ' aes-wiese__blume--da' : ''}`}
            style={{ ...lage(p), animationDelay: `${(Math.max(0, i - bisher) % 20) * 0.045}s` }}
          />
        ))}
        {sprossen.map((p) => (
          <span key={`s${p.order}`} className={`aes-wiese__spross fl-spross-${p.size}`} style={lage(p)} />
        ))}
      </div>
    </div>
  )
}

import { STUFEN, trendPfeil, trendText, type Auswertung, type Einstellungen } from '../lib/lernstand'

// Feld in der Heatmap: Farbe UND Symbol (für Farbsehschwäche und Schwarz-Weiß-Druck).
export function StufenFeld({ a }: { a: Auswertung | undefined }) {
  if (!a) return <span className="stufen-feld leer" aria-label="keine Daten" />
  if (a.stufe === null) return <span className="stufen-feld wenig" title="noch nicht genug Daten">·</span>
  const s = STUFEN[a.stufe]
  return (
    <span className="stufen-feld" style={{ background: s.farbe, color: s.text }} title={s.name}>
      {s.symbol}
      {a.trend_gueltig && <small className="trend">{trendPfeil(a)}</small>}
    </span>
  )
}

// Balken mit Stufe, Startmarke, Trendpfeil und Textzeile.
export function StufenBalken({ a, e }: { a: Auswertung; e: Einstellungen }) {
  const grenzen = [e.grenze_minus, e.grenze_o, e.grenze_plus, e.grenze_plusplus]
  const s = a.stufe !== null ? STUFEN[a.stufe] : null
  return (
    <div className="balken-block">
      <div className="balken" role="img" aria-label={s ? `Stufe ${s.symbol}` : 'noch nicht genug Daten'}>
        {/* Hintergrund: Stufenbereiche hell eingefärbt */}
        {[0, ...grenzen].map((von, i) => (
          <div
            key={i}
            className="balken-bereich"
            style={{ left: `${von}%`, width: `${(grenzen[i] ?? 100) - von}%`, background: STUFEN[i].farbe }}
          />
        ))}
        {a.punkte !== null && s && (
          <div className="balken-fuellung" style={{ width: `${Math.max(a.punkte, 8)}%`, background: s.farbe, color: s.text }}>
            <span>{s.symbol}</span>
          </div>
        )}
        {a.start_punkte !== null && (
          <div className="balken-start" style={{ left: `${a.start_punkte}%` }} title={`Startstand ${STUFEN[a.start_stufe ?? 0].symbol}`}>
            <span>Start</span>
          </div>
        )}
      </div>
      <div className="balken-text">
        {a.punkte !== null && <strong className="trend-pfeil">{trendPfeil(a)}</strong>} {trendText(a, e)}
      </div>
    </div>
  )
}

// Verlaufskurve des Stands (nach jedem gewerteten Versuch), mit Stufengrenzen.
export function Verlauf({ a, e }: { a: Auswertung; e: Einstellungen }) {
  const punkte = a.verlauf ?? []
  if (punkte.length < 2) return null
  const breite = 260
  const hoehe = 70
  const x = (i: number) => 6 + (i / (punkte.length - 1)) * (breite - 12)
  const y = (p: number) => hoehe - 4 - (p / 100) * (hoehe - 8)
  const linie = punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.punkte).toFixed(1)}`).join(' ')
  return (
    <svg className="verlauf" viewBox={`0 0 ${breite} ${hoehe}`} role="img" aria-label="Verlauf des Lernstands">
      {[e.grenze_minus, e.grenze_o, e.grenze_plus, e.grenze_plusplus].map((g) => (
        <line key={g} x1="0" x2={breite} y1={y(g)} y2={y(g)} className="verlauf-grenze" />
      ))}
      <path d={linie} className="verlauf-linie" />
      {punkte.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.punkte)} r="2.5" className="verlauf-punkt" />
      ))}
    </svg>
  )
}

export function Legende() {
  return (
    <p className="legende">
      {STUFEN.map((s) => (
        <span key={s.symbol}>
          <span className="stufen-feld" style={{ background: s.farbe, color: s.text }}>
            {s.symbol}
          </span>
        </span>
      ))}
      <span>
        <span className="stufen-feld" style={{ background: STUFEN[3].farbe }}>
          + <small className="trend">↑</small>
        </span>{' '}
        mit Trend
      </span>
      <span>
        <span className="stufen-feld wenig">·</span> noch nicht genug Daten
      </span>
    </p>
  )
}

import { datum, STUFEN, trendPfeil, trendText, type Auswertung, type Einstellungen } from '../lib/lernstand'

// Feld in der Heatmap: Farbe UND Symbol (für Farbsehschwäche und Schwarz-Weiß-Druck).
export function StufenFeld({ a }: { a: Auswertung | undefined }) {
  if (!a || a.stufe === null)
    return (
      <span className="stufen-feld wenig" title="noch nicht genug Daten" aria-label="noch nicht genug Daten">
        –
      </span>
    )
  const s = STUFEN[a.stufe]
  return (
    <span className="stufen-feld" style={{ background: s.farbe, color: s.text }} title={s.name}>
      {s.symbol}
      {a.trend_gueltig && <small className="trend">{trendPfeil(a)}</small>}
    </span>
  )
}

// Endpunkt der Stufe im Balken (20 % … 100 %), wie im Baustein LevelBar.
const stufenBreite = (stufe: number) => (stufe + 1) * 20
const STUFEN_KLASSE = ['m2', 'm1', 'o', 'p1', 'p2']

// Stufenbalken (Baustein aes-level): Symbol im Balken, Startmarke, Trend mit Text.
export function StufenStreifen({ a, e, name }: { a: Auswertung; e: Einstellungen; name: string }) {
  if (a.stufe === null) {
    return (
      <div className="aes-level aes-level--nodata level-gestapelt">
        <span className="aes-level__label">{name}</span>
        <div className="aes-level__track" role="img" aria-label={`${name}: noch nicht genug Daten`}>
          <div className="aes-level__fill">noch nicht genug Daten</div>
        </div>
        <span className="aes-level__trend">{trendText(a, e)}</span>
      </div>
    )
  }
  const s = STUFEN[a.stufe]
  return (
    <div className={`aes-level aes-level--${STUFEN_KLASSE[a.stufe]} level-gestapelt`}>
      <span className="aes-level__label">{name}</span>
      <div className="aes-level__track" role="img" aria-label={`${name}: Stufe ${s.symbol}. ${trendText(a, e)}`}>
        <div className="aes-level__fill">{s.symbol}</div>
        {a.start_stufe !== null && (
          <div
            className="aes-level__start"
            style={{ left: `calc(${stufenBreite(a.start_stufe)}% - 4px)` }}
            title={`Startstand ${STUFEN[a.start_stufe].symbol}`}
          />
        )}
      </div>
      <span className="aes-level__trend">
        <b aria-hidden="true">{trendPfeil(a)}</b>
        {trendText(a, e)}
      </span>
    </div>
  )
}

// Verlaufskurve des Stands (nach jedem gewerteten Versuch), mit Stufengrenzen und Datum je Versuch.
export function Verlauf({ a, e }: { a: Auswertung; e: Einstellungen }) {
  const punkte = a.verlauf ?? []
  if (punkte.length < 2) return null
  const breite = 340
  const kurve = 80 // Höhe des Kurvenbereichs, darunter Platz für die Daten
  const x = (i: number) => 18 + (i / (punkte.length - 1)) * (breite - 36)
  const y = (p: number) => kurve - 4 - (p / 100) * (kurve - 8)
  const linie = punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.punkte).toFixed(1)}`).join(' ')
  // Datum unter jedem Versuch. Wird es eng, stehen die Daten versetzt in zwei Zeilen;
  // erst bei sehr vielen Versuchen wird nur noch jedes n-te Datum beschriftet (das letzte immer).
  const abstand = (breite - 36) / (punkte.length - 1)
  const zweiZeilen = abstand < 40
  const jedes = Math.max(1, Math.ceil(40 / (abstand * (zweiZeilen ? 2 : 1))))
  const kurz = (zeit: string) => new Date(zeit).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  const beschriftet = punkte
    .map((_, i) => i)
    .filter((i) => i === punkte.length - 1 || (i % jedes === 0 && punkte.length - 1 - i >= jedes))
  const zeile = new Map(beschriftet.map((i, nr) => [i, zweiZeilen ? nr % 2 : 0]))
  const hoehe = kurve + (zweiZeilen ? 32 : 20)
  return (
    <svg className="verlauf" viewBox={`0 0 ${breite} ${hoehe}`} role="img" aria-label="Verlauf des Lernstands mit Datum">
      {[e.grenze_minus, e.grenze_o, e.grenze_plus, e.grenze_plusplus].map((g) => (
        <line key={g} x1="0" x2={breite} y1={y(g)} y2={y(g)} className="verlauf-grenze" />
      ))}
      <path d={linie} className="verlauf-linie" />
      {punkte.map((p, i) => {
        const z = zeile.get(i)
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.punkte)} r="2.8" className="verlauf-punkt">
              <title>{datum(p.zeit)}</title>
            </circle>
            {z !== undefined && (
              <>
                <line x1={x(i)} x2={x(i)} y1={kurve} y2={kurve + 4 + z * 12} className="verlauf-strich" />
                <text x={x(i)} y={kurve + 15 + z * 12} className="verlauf-datum" textAnchor="middle">
                  {kurz(p.zeit)}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function Legende() {
  return (
    <p className="legende">
      <span className="legende__titel">Stufen:</span>
      {STUFEN.map((s) => (
        <span key={s.symbol} className="stufen-feld" style={{ background: s.farbe, color: s.text }}>
          {s.symbol}
        </span>
      ))}
      <span>
        <span className="stufen-feld wenig">–</span> noch nicht genug Daten
      </span>
      <span>
        <span className="stufen-feld" style={{ background: STUFEN[3].farbe, color: STUFEN[3].text }}>
          + <small className="trend">↗</small>
        </span>{" "}
        mit Trend
      </span>
    </p>
  )
}

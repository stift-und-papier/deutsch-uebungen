import { useState } from 'react'
import type { Antwort, Antworten, AuswahlTeilOhneLoesung, LueckentextInhaltSchueler, Pruefergebnis } from '../lib/typen'
import { lueckenBreite } from '../lib/lueckentext'
import { ReiheAnzeige } from './ReiheAnzeige'

type Props = {
  inhalt: LueckentextInhaltSchueler
  antworten: Antworten
  onAntwort: (id: number, wert: Antwort) => void
  ergebnis?: Pruefergebnis | null
  /** Lösungen pro Stelle (nur nach "Lösung ansehen") */
  loesungen?: Record<number, string[]> | null
  gesperrt?: boolean
}

// Zeigt den Aufgabentext mit Lücken (Baustein aes-gap), Auswahl-Stellen (aes-choice) und – beim Zuordnen –
// antippbaren Wörtern mit „Stiften“ für die Kategorien.
// Nach dem Prüfen: richtige Stellen grün mit ✓ (gesperrt), andere warm (Pfirsich) mit ↻ – nie rot.
export function LueckentextAnzeige({ inhalt, antworten, onAntwort, ergebnis, loesungen, gesperrt }: Props) {
  const status = new Map(ergebnis?.luecken.map((l) => [l.id, l.richtig]))
  const kategorien = inhalt.kategorien ?? []
  const mitStiften = kategorien.length > 0 && inhalt.teile.some((t) => t.t === 'einheit')
  // Gewählter „Stift“ (Kategorie); zu Beginn der erste
  const [stift, setStift] = useState<string>(kategorien[0] ?? '')
  const farbe = (kategorie: string) => `kat-${Math.max(0, kategorien.indexOf(kategorie)) % 5}`

  const mitWoertern = inhalt.teile.some((t) => t.t === 'wort')

  // Format „Reihenfolge“: jeder Satz ist eine eigene Reihe zum Ordnen
  const reihen = inhalt.teile.flatMap((t) => (t.t === 'reihe' ? [t] : []))
  if (reihen.length > 0)
    return (
      <div className="reihen">
        {reihen.map((teil, nr) => {
          const varianten = Math.max(1, teil.varianten ?? 1)
          const a = antworten[teil.id]
          // Antwort: bei einer Variante eine Liste von Kennungen, bei mehreren eine Liste je Variante
          const gelegt: string[][] = !Array.isArray(a)
            ? []
            : Array.isArray(a[0])
              ? (a as string[][]).map((l) => l.map(String))
              : [(a as string[]).map(String)]
          return (
            <ReiheAnzeige
              key={teil.id}
              teil={teil}
              nr={nr}
              gelegt={gelegt}
              onAenderung={(neu) => onAntwort(teil.id, varianten > 1 ? neu : neu[0])}
              ergebnisse={Array.from({ length: varianten }, (_, j) =>
                ergebnis?.luecken.find((l) => l.id === teil.id && (l.variante ?? 0) === j),
              )}
              loesung={loesungen?.[teil.id]}
              gesperrt={Boolean(gesperrt)}
            />
          )
        })}
      </div>
    )

  return (
    <>
    {mitWoertern && (
      <p className="fehler-hinweis">
        {inhalt.anzahl_fehler ? <strong>Finde {inhalt.anzahl_fehler} Fehler. </strong> : null}
        {inhalt.korrigieren
          ? 'Tippe ein Fehlerwort an und schreib die richtige Form daneben.'
          : 'Tippe die Wörter mit Fehlern an.'}
      </p>
    )}
    {mitStiften && (
      <div className="stifte" role="group" aria-label="Kategorie wählen">
        <span className="stifte__text">Wähle eine Kategorie und tippe die passenden Wörter an:</span>
        <span className="stifte__liste">
          {kategorien.map((k) => (
            <button
              key={k}
              type="button"
              className={`aes-choice stift ${farbe(k)}`}
              aria-pressed={stift === k}
              disabled={gesperrt}
              onClick={() => setStift(k)}
            >
              <span className="stift__punkt" aria-hidden="true" />
              {k}
            </button>
          ))}
        </span>
      </div>
    )}
    <p className="aes-task aufgabe-text">
      {inhalt.teile.map((teil, index) => {
        if (teil.t === 'text') return <span key={index}>{teil.v}</span>
        const richtig = status.get(teil.id)
        const zeichen = (
          <>
            {richtig === true && <span className="markierung" aria-label="richtig">✓</span>}
            {richtig === false && <span className="markierung" aria-label="schau nochmal hin">↻</span>}
            {loesungen?.[teil.id] && <span className="loesung-anzeige">{loesungen[teil.id].join(' / ')}</span>}
          </>
        )

        if (teil.t === 'wort') {
          const a = antworten[teil.id]
          const markiert = a === true || typeof a === 'string'
          const zustand = richtig === true ? ' fehlerwort--ok' : richtig === false ? ' fehlerwort--again' : ''
          const fertig = gesperrt || richtig === true
          return (
            <span key={index} className="luecke-rahmen">
              <button
                type="button"
                className={`fehlerwort${markiert ? ' fehlerwort--markiert' : ''}${zustand}`}
                aria-pressed={markiert}
                aria-label={markiert ? `${teil.v}, als Fehler markiert` : teil.v}
                disabled={fertig}
                // Antippen markiert, erneutes Antippen nimmt die Markierung (und die Verbesserung) wieder weg
                onClick={() => onAntwort(teil.id, markiert ? false : true)}
              >
                {teil.v}
              </button>
              {markiert && inhalt.korrigieren && (
                <>
                  <span className="fehlerwort__pfeil" aria-hidden="true">
                    →
                  </span>
                  <input
                    className={`aes-gap fehlerwort__eingabe${richtig === true ? ' aes-gap--ok' : richtig === false ? ' aes-gap--again' : ''}`}
                    style={{ width: `${lueckenBreite(Math.max(teil.v.length, typeof a === 'string' ? a.length : 0))}ch` }}
                    aria-label={`Richtige Form für „${teil.v}“`}
                    value={typeof a === 'string' ? a : ''}
                    disabled={fertig}
                    autoFocus={a === true}
                    onChange={(e) => onAntwort(teil.id, e.target.value === '' ? true : e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </>
              )}
              {zeichen}
            </span>
          )
        }

        if (teil.t === 'einheit') {
          const wahl = typeof antworten[teil.id] === 'string' ? (antworten[teil.id] as string) : ''
          const zustand = richtig === true ? ' einheit--ok' : richtig === false ? ' einheit--again' : ''
          return (
            <span key={index} className="luecke-rahmen">
              <button
                type="button"
                className={`einheit${wahl ? ` einheit--markiert ${farbe(wahl)}` : ''}${zustand}`}
                aria-pressed={Boolean(wahl)}
                aria-label={wahl ? `${teil.v}, markiert als ${wahl}` : teil.v}
                disabled={gesperrt || richtig === true}
                // Gleicher Stift nimmt die Markierung wieder weg, anderer Stift ersetzt sie
                onClick={() => onAntwort(teil.id, wahl === stift ? '' : stift)}
              >
                <span className="einheit__wort">{teil.v}</span>
                {wahl && <span className="einheit__kat">{wahl}</span>}
              </button>
              {zeichen}
            </span>
          )
        }

        if (teil.t === 'auswahl') {
          return (
            <Auswahl
              key={index}
              teil={teil}
              dropdown={inhalt.darstellung === 'dropdown' && !teil.mehrfach}
              gewaehlt={Array.isArray(antworten[teil.id]) ? (antworten[teil.id] as number[]).map(Number) : []}
              onWahl={(neu) => onAntwort(teil.id, neu)}
              richtig={richtig}
              gesperrt={gesperrt || richtig === true}
              zeichen={zeichen}
            />
          )
        }

        const wert = typeof antworten[teil.id] === 'string' ? (antworten[teil.id] as string) : ''
        const breite = lueckenBreite(Math.max(wert.length, 4))
        const klasse = richtig === true ? 'aes-gap aes-gap--ok' : richtig === false ? 'aes-gap aes-gap--again' : 'aes-gap'
        return (
          <span key={index} className="luecke-rahmen">
            <input
              className={klasse}
              style={{ width: `${breite}ch` }}
              aria-label={`Lücke ${teil.id + 1}`}
              value={wert}
              disabled={gesperrt || richtig === true}
              onChange={(e) => onAntwort(teil.id, e.target.value)}
              // Wichtig für Rechtschreibübungen: keine automatische Korrektur durch das iPad
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="next"
            />
            {zeichen}
          </span>
        )
      })}
    </p>
    </>
  )
}

type AuswahlProps = {
  teil: AuswahlTeilOhneLoesung
  dropdown: boolean
  gewaehlt: number[]
  onWahl: (neu: number[]) => void
  richtig: boolean | undefined
  gesperrt: boolean
  zeichen: React.ReactNode
}

// Eine Auswahl-Stelle: Antippen (Standard, auch Mehrfachauswahl) oder Dropdown (nur Einfachauswahl).
function Auswahl({ teil, dropdown, gewaehlt, onWahl, richtig, gesperrt, zeichen }: AuswahlProps) {
  const zustand = richtig === true ? ' auswahl--ok' : richtig === false ? ' auswahl--again' : ''
  const beschriftung = `Auswahl ${teil.id + 1}${teil.mehrfach ? ' (mehrere Antworten richtig)' : ''}`

  if (dropdown) {
    return (
      <span className="luecke-rahmen">
        <select
          className={`aes-gap auswahl-dropdown${richtig === true ? ' aes-gap--ok' : richtig === false ? ' aes-gap--again' : ''}`}
          aria-label={beschriftung}
          value={gewaehlt[0] ?? ''}
          disabled={gesperrt}
          onChange={(e) => onWahl(e.target.value === '' ? [] : [Number(e.target.value)])}
        >
          <option value="">– wählen –</option>
          {teil.optionen.map((o, nr) => (
            <option key={nr} value={nr}>
              {o}
            </option>
          ))}
        </select>
        {zeichen}
      </span>
    )
  }

  function antippen(nr: number) {
    if (teil.mehrfach) onWahl(gewaehlt.includes(nr) ? gewaehlt.filter((x) => x !== nr) : [...gewaehlt, nr].sort((a, b) => a - b))
    else onWahl(gewaehlt[0] === nr ? [] : [nr])
  }

  return (
    <span className={`auswahl${zustand}`} role="group" aria-label={beschriftung}>
      {teil.mehrfach && <span className="auswahl__hinweis">Mehrere sind richtig:</span>}
      {teil.optionen.map((o, nr) => (
        <button
          key={nr}
          type="button"
          className="aes-choice"
          aria-pressed={gewaehlt.includes(nr)}
          disabled={gesperrt}
          onClick={() => antippen(nr)}
        >
          {gewaehlt.includes(nr) && <span aria-hidden="true">✓ </span>}
          {o}
        </button>
      ))}
      {zeichen}
    </span>
  )
}

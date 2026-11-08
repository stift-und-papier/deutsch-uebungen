import { useCallback, useEffect, useState } from 'react'
import { KERNCURRICULA } from '../lib/csv'
import { fehlerText } from '../lib/fehler'
import { erzeugePseudonyme, pseudonymListeLesen } from '../lib/pseudonyme'
import { gehe, schuelerLink } from '../lib/router'
import { supabase } from '../lib/supabase'
import { stufeAusPunkte, STUFEN, type Auswertung, type Einstellungen } from '../lib/lernstand'
import { sternText, type Klasse, type Schueler, type Stufe } from '../lib/typen'
import { Sterne } from '../gemeinsam/Sterne'

type SchuelerMitVersuchen = Schueler & { versuche: { count: number }[] }
type Mittelwert = { punkte: number; kompetenzen: number }

// Mittelwert aller Lernstände (nur Kompetenzen, für die schon eine Stufe berechnet ist).
function mittelwerteBerechnen(zeilen: { schueler_id: string; daten: Auswertung | null }[]): Map<string, Mittelwert> {
  const summe = new Map<string, { summe: number; anzahl: number }>()
  for (const z of zeilen) {
    if (z.daten?.punkte == null) continue
    const alt = summe.get(z.schueler_id) ?? { summe: 0, anzahl: 0 }
    summe.set(z.schueler_id, { summe: alt.summe + z.daten.punkte, anzahl: alt.anzahl + 1 })
  }
  return new Map([...summe].map(([id, w]) => [id, { punkte: w.summe / w.anzahl, kompetenzen: w.anzahl }]))
}

export function KlasseDetail({ klasseId }: { klasseId: string }) {
  const [klasse, setKlasse] = useState<Klasse | null>(null)
  const [schueler, setSchueler] = useState<SchuelerMitVersuchen[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [anzahl, setAnzahl] = useState(25)
  const [liste, setListe] = useState('')
  const [modus, setModus] = useState<'automatisch' | 'liste'>('automatisch')
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null)
  const [entwurf, setEntwurf] = useState('')
  const [mittelwerte, setMittelwerte] = useState<Map<string, Mittelwert>>(new Map())
  const [einstellungen, setEinstellungen] = useState<Einstellungen | null>(null)
  const [sortierung, setSortierung] = useState<{ nach: 'name' | 'stand'; auf: boolean }>({ nach: 'name', auf: true })
  // Automatische Stufen je Bereich (nur Bereiche, in denen schon aufgestiegen wurde; sonst gilt 1 Stern)
  const [autoStufen, setAutoStufen] = useState<{ schueler_id: string; bereich: string; stufe: Stufe }[]>([])

  const laden = useCallback(async () => {
    const [k, s, l, e, st] = await Promise.all([
      supabase.from('klassen').select('*').eq('id', klasseId).single(),
      supabase.from('schueler').select('*, versuche(count)').eq('klasse_id', klasseId).order('pseudonym'),
      supabase.rpc('lernstand_klasse', { p_klasse: klasseId }),
      supabase.from('einstellungen').select('*').single(),
      supabase.from('schueler_stufen').select('schueler_id, bereich, stufe').order('bereich'),
    ])
    if (k.error) return setFehler(fehlerText(k.error))
    if (s.error) return setFehler(fehlerText(s.error))
    setKlasse(k.data as Klasse)
    setSchueler(s.data as SchuelerMitVersuchen[])
    if (!st.error) setAutoStufen(st.data as typeof autoStufen)
    if (!l.error && !e.error) {
      setMittelwerte(mittelwerteBerechnen(l.data as { schueler_id: string; daten: Auswertung | null }[]))
      setEinstellungen(e.data as Einstellungen)
    }
  }, [klasseId])

  useEffect(() => {
    void laden()
  }, [laden])

  async function hinzufuegen(namen: string[]) {
    if (namen.length === 0) return
    const { error } = await supabase.from('schueler').insert(namen.map((pseudonym) => ({ klasse_id: klasseId, pseudonym })))
    if (error) setFehler(fehlerText(error))
    else {
      setFehler(null)
      setMeldung(`${namen.length} Schüler:innen angelegt.`)
      void laden()
    }
  }

  // Umbenennen direkt in der Liste: Pseudonym antippen, ändern, Enter (Esc bricht ab).
  async function umbenennenSpeichern(s: Schueler) {
    const neu = entwurf.trim()
    setUmbenennenId(null)
    if (!neu || neu === s.pseudonym) return
    const { error } = await supabase.from('schueler').update({ pseudonym: neu }).eq('id', s.id)
    if (error) setFehler(fehlerText(error))
    else void laden()
  }

  // Manuelle Stufe setzen (1–3) oder mit „automatisch“ (null) aufheben
  async function stufeSetzen(s: Schueler, wert: string) {
    const { error } = await supabase
      .from('schueler')
      .update({ stufe_manuell: wert ? Number(wert) : null })
      .eq('id', s.id)
    if (error) setFehler(fehlerText(error))
    else void laden()
  }

  async function loeschen(s: Schueler) {
    const ok = window.confirm(
      `${s.pseudonym} wirklich löschen?\n\nAlle Ergebnisse dieser Person werden endgültig gelöscht. Das kann nicht rückgängig gemacht werden.`,
    )
    if (!ok) return
    const { error } = await supabase.from('schueler').delete().eq('id', s.id)
    if (error) setFehler(fehlerText(error))
    else void laden()
  }

  async function klasseLoeschen() {
    if (!klasse) return
    const eingabe = window.prompt(
      `Die Klasse „${klasse.name}“ mit allen ${schueler.length} Schüler:innen und allen Ergebnissen endgültig löschen?\n\nDas kann nicht rückgängig gemacht werden. Zur Bestätigung den Klassennamen eintippen:`,
    )
    if (eingabe?.trim() !== klasse.name) return
    const { error } = await supabase.from('klassen').delete().eq('id', klasse.id)
    if (error) setFehler(fehlerText(error))
    else gehe('/lehrkraft/klassen')
  }

  async function linkKopieren(s: Schueler) {
    try {
      await navigator.clipboard.writeText(schuelerLink(s.token))
      setMeldung(`Link von ${s.pseudonym} kopiert.`)
    } catch {
      window.prompt('Link zum Kopieren:', schuelerLink(s.token))
    }
  }

  function sortieren(nach: 'name' | 'stand') {
    setSortierung((alt) => (alt.nach === nach ? { nach, auf: !alt.auf } : { nach, auf: nach === 'name' }))
  }
  const pfeil = (nach: 'name' | 'stand') => (sortierung.nach === nach ? (sortierung.auf ? '▲' : '▼') : '⇅')

  // Nach Name (A–Z) oder nach Ø Lernstand; ohne Daten stehen immer am Ende.
  const sortiert = [...schueler].sort((a, b) => {
    if (sortierung.nach === 'stand') {
      const pa = mittelwerte.get(a.id)?.punkte
      const pb = mittelwerte.get(b.id)?.punkte
      if (pa === undefined || pb === undefined) {
        if (pa !== pb) return pa === undefined ? 1 : -1
      } else if (pa !== pb) {
        return sortierung.auf ? pa - pb : pb - pa
      }
    }
    const v = a.pseudonym.localeCompare(b.pseudonym, 'de', { numeric: true })
    return sortierung.nach === 'name' && !sortierung.auf ? -v : v
  })

  if (!klasse) return fehler ? <p className="hinweis-box">{fehler}</p> : <p>Lädt …</p>

  return (
    <>
      <a className="aes-btn aes-btn--ghost zurueck" href="#/lehrkraft/klassen">
        ← Alle Klassen
      </a>
      <h1>Klasse {klasse.name}</h1>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      {meldung && <p className="erfolg-box">{meldung}</p>}

      <div className="knopfleiste">
        <a className="aes-btn aes-btn--primary" href={`#/lehrkraft/klassen/${klasse.id}/links`}>
          Linkliste mit QR-Codes
        </a>
        <a className="aes-btn knopf-auswertung" href={`#/lehrkraft/klassen/${klasse.id}/lernstand`}>
          📊 Lernstand der Klasse
        </a>
      </div>

      <div className="formular zeile">
        <label>
          Jahrgang
          <select
            value={klasse.jahrgang ?? ''}
            onChange={async (e) => {
              const { error } = await supabase
                .from('klassen')
                .update({ jahrgang: e.target.value ? Number(e.target.value) : null })
                .eq('id', klasse.id)
              if (error) setFehler(fehlerText(error))
              else void laden()
            }}
          >
            <option value="">– nicht festgelegt –</option>
            {[5, 6, 7, 8, 9, 10].map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kerncurriculum der Klasse
          <select
            value={klasse.kerncurriculum ?? ''}
            onChange={async (e) => {
              const { error } = await supabase
                .from('klassen')
                .update({ kerncurriculum: e.target.value || null })
                .eq('id', klasse.id)
              if (error) setFehler(fehlerText(error))
              else void laden()
            }}
          >
            <option value="">– bitte wählen –</option>
            {KERNCURRICULA.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>
      {!klasse.kerncurriculum && (
        <p className="hinweis-box">Bitte das Kerncurriculum der Klasse wählen – ohne KC wird kein Lernstand berechnet.</p>
      )}

      {schueler.length === 0 ? (
        <p>Noch keine Schüler:innen in dieser Klasse.</p>
      ) : (
        <table className="tabelle">
          <thead>
            <tr>
              <th>
                <button type="button" className="sortier-knopf" onClick={() => sortieren('name')}>
                  Pseudonym {pfeil('name')}
                </button>
              </th>
              <th>
                <button type="button" className="sortier-knopf" onClick={() => sortieren('stand')}>
                  Ø Lernstand {pfeil('stand')}
                </button>
              </th>
              <th>Stufe</th>
              <th>Versuche</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortiert.map((s) => {
              const m = mittelwerte.get(s.id)
              const stufe = m && einstellungen ? STUFEN[stufeAusPunkte(m.punkte, einstellungen)] : null
              return (
              <tr key={s.id}>
                <td>
                  {umbenennenId === s.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void umbenennenSpeichern(s)
                      }}
                    >
                      <input
                        className="pseudonym-eingabe"
                        aria-label="Neues Pseudonym"
                        value={entwurf}
                        onChange={(e) => setEntwurf(e.target.value)}
                        onBlur={(e) => {
                          if (!e.currentTarget.dataset.abbruch) void umbenennenSpeichern(s)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.currentTarget.dataset.abbruch = '1'
                            setUmbenennenId(null)
                          }
                        }}
                        autoFocus
                        maxLength={40}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="pseudonym-knopf"
                      title="Antippen zum Umbenennen"
                      onClick={() => {
                        setEntwurf(s.pseudonym)
                        setUmbenennenId(s.id)
                      }}
                    >
                      {s.pseudonym} <span aria-hidden="true">✎</span>
                    </button>
                  )}
                </td>
                <td>
                  {stufe && m ? (
                    <span title={`Durchschnitt aus ${m.kompetenzen} Kompetenz${m.kompetenzen === 1 ? '' : 'en'}`}>
                      <span className="stufen-feld" style={{ background: stufe.farbe, color: stufe.text }}>
                        {stufe.symbol}
                      </span>{' '}
                      <span className="klein">aus {m.kompetenzen}</span>
                    </span>
                  ) : (
                    <span className="klein">noch keine Daten</span>
                  )}
                </td>
                <td>
                  <div className="stufe-zelle">
                    {s.stufe_manuell ? (
                      <span>
                        <Sterne stufe={s.stufe_manuell} /> <span className="klein">manuell</span>
                      </span>
                    ) : (
                      <span>
                        {autoStufen
                          .filter((a) => a.schueler_id === s.id)
                          .map((a) => (
                            <span key={a.bereich} className="stufe-zelle__bereich">
                              <span className="klein">{a.bereich || 'ohne Bereich'}</span> <Sterne stufe={a.stufe} />
                            </span>
                          ))}
                        <span className="stufe-zelle__bereich">
                          {autoStufen.some((a) => a.schueler_id === s.id) && <span className="klein">sonst</span>}{' '}
                          <Sterne stufe={1} /> <span className="klein">automatisch</span>
                        </span>
                      </span>
                    )}
                    <select
                      aria-label={`Stufe von ${s.pseudonym}`}
                      value={s.stufe_manuell ?? ''}
                      onChange={(e) => void stufeSetzen(s, e.target.value)}
                    >
                      <option value="">automatisch</option>
                      {([1, 2, 3] as const).map((n) => (
                        <option key={n} value={n}>
                          {sternText(n)} manuell
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>{s.versuche[0]?.count ?? 0}</td>
                <td className="aktionen">
                  <a className="aes-btn knopf-auswertung aes-btn--klein" href={`#/lehrkraft/schueler/${s.id}`}>
                    📊 Lernstand
                  </a>
                  <button className="aes-btn aes-btn--secondary aes-btn--klein" onClick={() => void linkKopieren(s)}>
                    Link kopieren
                  </button>
                  <a className="aes-btn aes-btn--secondary aes-btn--klein" href={schuelerLink(s.token)} target="_blank" rel="noreferrer">
                    Als Schüler:in ansehen
                  </a>
                  <a className="aes-btn aes-btn--secondary knopf-auswertung-rand aes-btn--klein" href={`#/lehrkraft/schueler/${s.id}/drucken`}>
                    🖨 Entwicklung drucken
                  </a>
                  <button className="aes-btn aes-btn--secondary knopf-gefahr aes-btn--klein" onClick={() => void loeschen(s)}>
                    Löschen
                  </button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="klein">
        Pseudonym antippen zum Umbenennen. „Stufe“: Automatisch beginnen alle mit 1 Stern und steigen je Bereich auf,
        wenn sie genug Aufgaben dieser Stufe im ersten Versuch richtig lösen (nie zurück). Eine manuell
        gewählte Stufe gilt für alle Bereiche und hat Vorrang; „automatisch“ hebt sie wieder auf. „Ø Lernstand“ ist der Durchschnitt aller Kompetenzen, für die schon eine Stufe
        berechnet ist. Hinweis: Mit „Als Schüler:in ansehen“ zählen Ihre eigenen Versuche wie Versuche dieser Person. Zum Ausprobieren
        besser eine eigene Test-Person anlegen (z. B. „Test-Lehrkraft“).
      </p>

      <section className="kasten">
        <h2>Schüler:innen hinzufügen</h2>
        <p className="klein">Bitte nur Pseudonyme verwenden, keine echten Namen. Die Zuordnung führen Sie außerhalb der App.</p>
        <div className="umschalter" role="tablist">
          <button role="tab" aria-selected={modus === 'automatisch'} onClick={() => setModus('automatisch')}>
            Automatisch erzeugen
          </button>
          <button role="tab" aria-selected={modus === 'liste'} onClick={() => setModus('liste')}>
            Eigene Liste
          </button>
        </div>
        {modus === 'automatisch' ? (
          <form
            className="formular zeile"
            onSubmit={(e) => {
              e.preventDefault()
              void hinzufuegen(erzeugePseudonyme(anzahl, schueler.map((s) => s.pseudonym)))
            }}
          >
            <label>
              Anzahl
              <input type="number" min={1} max={40} value={anzahl} onChange={(e) => setAnzahl(Number(e.target.value))} />
            </label>
            <button className="aes-btn aes-btn--primary">Pseudonyme erzeugen (z. B. Fuchs-07)</button>
          </form>
        ) : (
          <form
            className="formular"
            onSubmit={(e) => {
              e.preventDefault()
              const { neu, doppelt } = pseudonymListeLesen(liste, schueler.map((s) => s.pseudonym))
              if (doppelt.length) setMeldung(`Übersprungen, weil schon vorhanden: ${doppelt.join(', ')}`)
              void hinzufuegen(neu).then(() => setListe(''))
            }}
          >
            <label>
              Ein Pseudonym pro Zeile
              <textarea rows={6} value={liste} onChange={(e) => setListe(e.target.value)} placeholder={'Komet-1\nKomet-2\nKomet-3'} />
            </label>
            <button className="aes-btn aes-btn--primary">Hinzufügen</button>
          </form>
        )}
      </section>

      <section className="kasten gefahrzone">
        <h2>Klasse löschen</h2>
        <p className="klein">Löscht die Klasse, alle Schüler:innen und alle Ergebnisse endgültig.</p>
        <button className="aes-btn aes-btn--secondary knopf-gefahr" onClick={() => void klasseLoeschen()}>
          Klasse „{klasse.name}“ löschen
        </button>
      </section>
    </>
  )
}

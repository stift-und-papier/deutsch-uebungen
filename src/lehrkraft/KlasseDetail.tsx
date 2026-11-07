import { useCallback, useEffect, useState } from 'react'
import { KERNCURRICULA } from '../lib/csv'
import { fehlerText } from '../lib/fehler'
import { erzeugePseudonyme, pseudonymListeLesen } from '../lib/pseudonyme'
import { gehe, schuelerLink } from '../lib/router'
import { supabase } from '../lib/supabase'
import type { Klasse, Schueler } from '../lib/typen'

type SchuelerMitVersuchen = Schueler & { versuche: { count: number }[] }

export function KlasseDetail({ klasseId }: { klasseId: string }) {
  const [klasse, setKlasse] = useState<Klasse | null>(null)
  const [schueler, setSchueler] = useState<SchuelerMitVersuchen[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [anzahl, setAnzahl] = useState(25)
  const [liste, setListe] = useState('')
  const [modus, setModus] = useState<'automatisch' | 'liste'>('automatisch')

  const laden = useCallback(async () => {
    const [k, s] = await Promise.all([
      supabase.from('klassen').select('*').eq('id', klasseId).single(),
      supabase.from('schueler').select('*, versuche(count)').eq('klasse_id', klasseId).order('pseudonym'),
    ])
    if (k.error) return setFehler(fehlerText(k.error))
    if (s.error) return setFehler(fehlerText(s.error))
    setKlasse(k.data as Klasse)
    setSchueler(s.data as SchuelerMitVersuchen[])
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

  async function kcSetzen(ids: string[], kc: string | null) {
    const { error } = await supabase.from('schueler').update({ kerncurriculum: kc }).in('id', ids)
    if (error) setFehler(fehlerText(error))
    else void laden()
  }

  async function umbenennen(s: Schueler) {
    const neu = window.prompt('Neues Pseudonym (bitte keinen echten Namen):', s.pseudonym)?.trim()
    if (!neu || neu === s.pseudonym) return
    const { error } = await supabase.from('schueler').update({ pseudonym: neu }).eq('id', s.id)
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

  if (!klasse) return fehler ? <p className="hinweis-box">{fehler}</p> : <p>Lädt …</p>

  return (
    <>
      <a className="zurueck" href="#/lehrkraft/klassen">
        ← Alle Klassen
      </a>
      <h1>Klasse {klasse.name}</h1>
      {fehler && <p className="hinweis-box">{fehler}</p>}
      {meldung && <p className="erfolg-box">{meldung}</p>}

      <div className="knopfleiste">
        <a className="knopf haupt" href={`#/lehrkraft/klassen/${klasse.id}/links`}>
          Linkliste (drucken / für IServ)
        </a>
        <a className="knopf auswertung" href={`#/lehrkraft/klassen/${klasse.id}/lernstand`}>
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
        {schueler.length > 0 && (
          <label>
            Kerncurriculum für alle setzen
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && window.confirm(`Für alle ${schueler.length} Schüler:innen „${e.target.value}“ einstellen?`))
                  void kcSetzen(
                    schueler.map((s) => s.id),
                    e.target.value,
                  )
              }}
            >
              <option value="">– auswählen –</option>
              {KERNCURRICULA.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {schueler.length === 0 ? (
        <p>Noch keine Schüler:innen in dieser Klasse.</p>
      ) : (
        <table className="tabelle">
          <thead>
            <tr>
              <th>Pseudonym</th>
              <th>Kerncurriculum</th>
              <th>Versuche</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {schueler.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.pseudonym}</strong>
                </td>
                <td>
                  <select
                    className="klein-auswahl"
                    aria-label={`Kerncurriculum von ${s.pseudonym}`}
                    value={s.kerncurriculum ?? ''}
                    onChange={(e) => void kcSetzen([s.id], e.target.value || null)}
                  >
                    <option value="">– bitte wählen –</option>
                    {KERNCURRICULA.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </td>
                <td>{s.versuche[0]?.count ?? 0}</td>
                <td className="aktionen">
                  <a className="knopf klein-knopf auswertung" href={`#/lehrkraft/schueler/${s.id}`}>
                    📊 Lernstand
                  </a>
                  <button className="knopf klein-knopf" onClick={() => void linkKopieren(s)}>
                    Link kopieren
                  </button>
                  <a className="knopf klein-knopf" href={schuelerLink(s.token)} target="_blank" rel="noreferrer">
                    Als Schüler:in ansehen
                  </a>
                  <button className="knopf klein-knopf leise" onClick={() => void umbenennen(s)}>
                    Umbenennen
                  </button>
                  <a className="knopf klein-knopf auswertung-rand" href={`#/lehrkraft/schueler/${s.id}/drucken`}>
                    🖨 Entwicklung drucken
                  </a>
                  <button className="knopf klein-knopf gefahr" onClick={() => void loeschen(s)}>
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="klein">
        Hinweis: Mit „Als Schüler:in ansehen“ zählen Ihre eigenen Versuche wie Versuche dieser Person. Zum Ausprobieren
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
            <button className="knopf haupt">Pseudonyme erzeugen (z. B. Fuchs-07)</button>
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
            <button className="knopf haupt">Hinzufügen</button>
          </form>
        )}
      </section>

      <section className="kasten gefahrzone">
        <h2>Klasse löschen</h2>
        <p className="klein">Löscht die Klasse, alle Schüler:innen und alle Ergebnisse endgültig.</p>
        <button className="knopf gefahr" onClick={() => void klasseLoeschen()}>
          Klasse „{klasse.name}“ löschen
        </button>
      </section>
    </>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { AufgabeBearbeiten } from '../gemeinsam/AufgabeBearbeiten'
import { fehlerText } from '../lib/fehler'
import { gehe } from '../lib/router'
import { supabase } from '../lib/supabase'
import type { Aufgabe, Klasse, Paket, PaketAufgabe, Pruefergebnis, Schueler, Zuweisung } from '../lib/typen'
import { ohneLoesung } from '../lib/lueckentext'
import { TYP_NAMEN } from './AufgabenListe'

type Daten = {
  paket: Paket
  inhalt: (PaketAufgabe & { aufgabe: Aufgabe })[]
  alleAufgaben: Aufgabe[]
  zuweisungen: Zuweisung[]
  klassen: Klasse[]
  schueler: Schueler[]
}

export function PaketDetail({ paketId, vorschau }: { paketId: string; vorschau: boolean }) {
  const [daten, setDaten] = useState<Daten | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    const [p, pa, a, z, k, s] = await Promise.all([
      supabase.from('pakete').select('*').eq('id', paketId).single(),
      supabase.from('paket_aufgaben').select('*, aufgabe:aufgaben(*)').eq('paket_id', paketId).order('position'),
      supabase.from('aufgaben').select('*').order('titel'),
      supabase.from('zuweisungen').select('*').eq('paket_id', paketId).order('erstellt_am'),
      supabase.from('klassen').select('*').order('name'),
      supabase.from('schueler').select('*').order('pseudonym'),
    ])
    const fehlerhaft = [p, pa, a, z, k, s].find((r) => r.error)
    if (fehlerhaft?.error) return setFehler(fehlerText(fehlerhaft.error))
    setDaten({
      paket: p.data as Paket,
      inhalt: pa.data as Daten['inhalt'],
      alleAufgaben: a.data as Aufgabe[],
      zuweisungen: z.data as Zuweisung[],
      klassen: k.data as Klasse[],
      schueler: s.data as Schueler[],
    })
  }, [paketId])

  useEffect(() => {
    void laden()
  }, [laden])

  if (!daten) return fehler ? <p className="hinweis-box">{fehler}</p> : <p>Lädt …</p>
  if (vorschau) return <PaketVorschau daten={daten} />

  const { paket, inhalt, alleAufgaben, zuweisungen, klassen, schueler } = daten
  const imPaket = new Set(inhalt.map((i) => i.aufgabe_id))
  const verfuegbar = alleAufgaben.filter((a) => !imPaket.has(a.id))
  const klassenName = (id: string | null) => klassen.find((k) => k.id === id)?.name ?? '?'

  async function ausfuehren(aktion: PromiseLike<{ error: unknown }>) {
    const { error } = await aktion
    if (error) setFehler(fehlerText(error))
    else {
      setFehler(null)
      void laden()
    }
  }

  async function verschieben(index: number, richtung: -1 | 1) {
    const neu = [...inhalt]
    const [eintrag] = neu.splice(index, 1)
    neu.splice(index + richtung, 0, eintrag)
    await ausfuehren(
      supabase.from('paket_aufgaben').upsert(neu.map((e, i) => ({ paket_id: paket.id, aufgabe_id: e.aufgabe_id, position: i }))),
    )
  }

  return (
    <>
      <a className="aes-btn aes-btn--ghost zurueck" href="#/lehrkraft/pakete">
        ← Alle Pakete
      </a>
      <PaketKopf paket={paket} onGeaendert={laden} onFehler={setFehler} />
      {fehler && <p className="hinweis-box">{fehler}</p>}

      <section className="kasten">
        <h2>Aufgaben in diesem Paket</h2>
        {inhalt.length === 0 ? (
          <p>Noch keine Aufgaben.</p>
        ) : (
          <ol className="paket-aufgaben">
            {inhalt.map((e, i) => (
              <li key={e.aufgabe_id}>
                <a href={`#/lehrkraft/aufgaben/${e.aufgabe_id}`}>{e.aufgabe.titel}</a>
                <span className="klein">
                  {' '}
                  · {TYP_NAMEN[e.aufgabe.typ]} · {e.aufgabe.schwierigkeit}
                </span>
                <span className="aktionen">
                  <button className="aes-btn aes-btn--ghost aes-btn--klein" disabled={i === 0} onClick={() => void verschieben(i, -1)} aria-label="nach oben">
                    ↑
                  </button>
                  <button
                    className="aes-btn aes-btn--ghost aes-btn--klein"
                    disabled={i === inhalt.length - 1}
                    onClick={() => void verschieben(i, 1)}
                    aria-label="nach unten"
                  >
                    ↓
                  </button>
                  <button
                    className="aes-btn aes-btn--ghost aes-btn--klein"
                    onClick={() =>
                      void ausfuehren(supabase.from('paket_aufgaben').delete().eq('paket_id', paket.id).eq('aufgabe_id', e.aufgabe_id))
                    }
                  >
                    Entfernen
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        {verfuegbar.length > 0 ? (
          <form
            className="formular zeile"
            onSubmit={(e) => {
              e.preventDefault()
              const id = new FormData(e.currentTarget).get('aufgabe') as string
              if (id) void ausfuehren(supabase.from('paket_aufgaben').insert({ paket_id: paket.id, aufgabe_id: id, position: inhalt.length }))
            }}
          >
            <label>
              Aufgabe hinzufügen
              <select name="aufgabe">
                {verfuegbar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titel} ({a.schwierigkeit})
                  </option>
                ))}
              </select>
            </label>
            <button className="aes-btn aes-btn--secondary">Hinzufügen</button>
          </form>
        ) : (
          <p className="klein">
            Alle Ihre Aufgaben sind schon in diesem Paket. <a href="#/lehrkraft/aufgaben/neu">Neue Aufgabe anlegen</a>
          </p>
        )}
        {inhalt.length > 0 && (
          <a className="aes-btn aes-btn--secondary" href={`#/lehrkraft/pakete/${paket.id}/vorschau`}>
            Vorschau: Paket wie Schüler:innen durcharbeiten
          </a>
        )}
      </section>

      <section className="kasten">
        <h2>Zugewiesen an</h2>
        {zuweisungen.length === 0 ? (
          <p>Noch niemandem. Schüler:innen sehen das Paket erst nach dem Zuweisen.</p>
        ) : (
          <ul className="zuweisungen">
            {zuweisungen.map((z) => {
              const s = schueler.find((x) => x.id === z.schueler_id)
              return (
                <li key={z.id}>
                  {z.klasse_id ? (
                    <>
                      Klasse <strong>{klassenName(z.klasse_id)}</strong> (alle)
                    </>
                  ) : (
                    <>
                      <strong>{s?.pseudonym}</strong> ({klassenName(s?.klasse_id ?? null)})
                    </>
                  )}{' '}
                  <button className="aes-btn aes-btn--ghost aes-btn--klein" onClick={() => void ausfuehren(supabase.from('zuweisungen').delete().eq('id', z.id))}>
                    Zuweisung entfernen
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <form
          className="formular zeile"
          onSubmit={(e) => {
            e.preventDefault()
            const wert = new FormData(e.currentTarget).get('ziel') as string
            if (!wert) return
            const [art, id] = wert.split(':')
            void ausfuehren(
              supabase.from('zuweisungen').insert(art === 'k' ? { paket_id: paket.id, klasse_id: id } : { paket_id: paket.id, schueler_id: id }),
            )
          }}
        >
          <label>
            Zuweisen an
            <select name="ziel">
              {klassen.map((k) => (
                <optgroup key={k.id} label={`Klasse ${k.name}`}>
                  <option value={`k:${k.id}`}>Ganze Klasse {k.name}</option>
                  {schueler
                    .filter((s) => s.klasse_id === k.id)
                    .map((s) => (
                      <option key={s.id} value={`s:${s.id}`}>
                        nur {s.pseudonym}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="aes-btn aes-btn--primary" disabled={klassen.length === 0}>
            Zuweisen
          </button>
        </form>
      </section>

      <section className="kasten gefahrzone">
        <button
          className="aes-btn aes-btn--secondary knopf-gefahr"
          onClick={async () => {
            if (!window.confirm(`Paket „${paket.titel}“ löschen?\n\nDie Aufgaben selbst bleiben erhalten. Schüler:innen sehen das Paket danach nicht mehr.`))
              return
            const { error } = await supabase.from('pakete').delete().eq('id', paket.id)
            if (error) setFehler(fehlerText(error))
            else gehe('/lehrkraft/pakete')
          }}
        >
          Paket löschen
        </button>
      </section>
    </>
  )
}

function PaketKopf({ paket, onGeaendert, onFehler }: { paket: Paket; onGeaendert: () => void; onFehler: (f: string) => void }) {
  const [bearbeiten, setBearbeiten] = useState(false)
  const [titel, setTitel] = useState(paket.titel)
  const [beschreibung, setBeschreibung] = useState(paket.beschreibung ?? '')

  if (!bearbeiten) {
    return (
      <>
        <h1>{paket.titel}</h1>
        {paket.beschreibung && <p>{paket.beschreibung}</p>}
        <button className="aes-btn aes-btn--ghost aes-btn--klein" onClick={() => setBearbeiten(true)}>
          Titel/Beschreibung ändern
        </button>
      </>
    )
  }
  return (
    <form
      className="formular"
      onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await supabase
          .from('pakete')
          .update({ titel: titel.trim(), beschreibung: beschreibung.trim() || null })
          .eq('id', paket.id)
        if (error) return onFehler(fehlerText(error))
        setBearbeiten(false)
        onGeaendert()
      }}
    >
      <label>
        Titel
        <input value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={120} />
      </label>
      <label>
        Beschreibung für Schüler:innen (optional)
        <input value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} />
      </label>
      <button className="aes-btn aes-btn--primary">Speichern</button>
    </form>
  )
}

// Vorschau: Das Paket so durcharbeiten, wie Schüler:innen es sehen. Es wird nichts gespeichert.
function PaketVorschau({ daten }: { daten: Daten }) {
  const [index, setIndex] = useState(0)
  const eintrag = daten.inhalt[index]
  if (!eintrag) return <p>Das Paket ist leer.</p>
  const a = eintrag.aufgabe

  let versuche = 0
  return (
    <>
      <a className="aes-btn aes-btn--ghost zurueck" href={`#/lehrkraft/pakete/${daten.paket.id}`}>
        ← Vorschau beenden
      </a>
      <p className="hinweis-box">Vorschau – so sehen Schüler:innen das Paket. Es wird nichts gespeichert.</p>
      <h1>{daten.paket.titel}</h1>
      <p className="klein">
        Aufgabe {index + 1} von {daten.inhalt.length}
      </p>
      <div className="vorschau-rahmen">
        <AufgabeBearbeiten
          key={a.id}
          aufgabe={{
            id: a.id,
            typ: a.typ,
            titel: a.titel,
            anweisung: a.anweisung,
            hinweis: a.hinweis,
            schwierigkeit: a.schwierigkeit,
            inhalt: ohneLoesung(a.inhalt.teile, a.inhalt.darstellung, a.inhalt.kategorien, a.inhalt),
            versuche: 0,
            geloest: false,
            loesung_angesehen: false,
          }}
          pruefen={async (antworten) => {
            const { data, error } = await supabase.rpc('pruefe_aufgabe', { p_typ: a.typ, p_inhalt: a.inhalt, p_antworten: antworten })
            if (error) throw new Error(fehlerText(error))
            const ergebnis = data as Pruefergebnis
            versuche++
            return { ergebnis, rueckmeldung: ergebnis.richtig ? null : a.rueckmeldung_fehler, versuche }
          }}
          loesungHolen={async () =>
            Object.fromEntries(
              a.inhalt.teile.flatMap((t) =>
                t.t === 'luecke'
                  ? [[t.id, t.loesungen]]
                  : t.t === 'auswahl' || t.t === 'versionen'
                    ? [[t.id, t.richtig.map((nr) => t.optionen[nr])]]
                    : t.t === 'einheit' && t.kategorie
                      ? [[t.id, [t.kategorie]]]
                      : t.t === 'wort' && t.korrekturen
                        ? [[t.id, t.korrekturen]]
                        : t.t === 'reihe'
                          ? [[t.id, t.loesungen.map((l) => l.join(' '))]]
                          : [],
              ),
            )
          }
          weiter={
            index + 1 < daten.inhalt.length
              ? { text: 'Nächste Aufgabe →', ziel: () => setIndex(index + 1) }
              : { text: 'Vorschau beenden', ziel: () => gehe(`/lehrkraft/pakete/${daten.paket.id}`) }
          }
        />
      </div>
      <div className="knopfleiste">
        <button className="aes-btn aes-btn--ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ← Vorherige
        </button>
        <button className="aes-btn aes-btn--ghost" disabled={index + 1 >= daten.inhalt.length} onClick={() => setIndex(index + 1)}>
          Überspringen →
        </button>
      </div>
    </>
  )
}

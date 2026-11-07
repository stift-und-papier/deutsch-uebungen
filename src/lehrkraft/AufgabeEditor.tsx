import { useEffect, useMemo, useState } from 'react'
import { AufgabeBearbeiten } from '../gemeinsam/AufgabeBearbeiten'
import { fehlerText } from '../lib/fehler'
import { ohneLoesung, stelleZuText, teileZuText, textZuTeilen } from '../lib/lueckentext'
import { gehe } from '../lib/router'
import { supabase } from '../lib/supabase'
import {
  SCHWIERIGKEITEN,
  type Antworten,
  type Aufgabe,
  type AufgabenTyp,
  type Darstellung,
  type LueckentextTeil,
  type Pruefergebnis,
  type Schwierigkeit,
} from '../lib/typen'
import { KompetenzAuswahl } from './KompetenzAuswahl'

// Je Format: Name, Standard-Arbeitsanweisung und Beispiel für den Texteingabe-Modus
const FORMATE: Record<AufgabenTyp, { name: string; anweisung: string; beispiel: string }> = {
  lueckentext: {
    name: 'Lückentext',
    anweisung: 'Ergänze die Lücken.',
    beispiel: 'Ich weiß, [dass] du heute [Rad fährst/radfährst].',
  },
  auswahl: {
    name: 'Auswahl',
    anweisung: 'Tippe die richtige Antwort an.',
    beispiel: 'Ich weiß, [das | *dass] du kommst.\n\nWelche Wörter sind Nomen?\n[*Hund | laufen | *Baum | schnell]',
  },
}

// Aufgabe anlegen oder bearbeiten (Lückentext oder Auswahl) – wahlweise als Text mit [Klammern] oder per Formular.
export function AufgabeEditor({ aufgabeId, neuerTyp = 'lueckentext' }: { aufgabeId: string | null; neuerTyp?: AufgabenTyp }) {
  const [typ, setTyp] = useState<AufgabenTyp>(neuerTyp)
  const [darstellung, setDarstellung] = useState<Darstellung>('antippen')
  const [titel, setTitel] = useState('')
  const [anweisung, setAnweisung] = useState(FORMATE[neuerTyp].anweisung)
  const [hinweis, setHinweis] = useState('')
  const [rueckmeldung, setRueckmeldung] = useState('')
  const [schwierigkeit, setSchwierigkeit] = useState<Schwierigkeit>('mittel')
  const [grossKlein, setGrossKlein] = useState(true)
  const [text, setText] = useState('')
  const [modus, setModus] = useState<'text' | 'formular'>('text')
  const [vorschau, setVorschau] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)
  const [geladen, setGeladen] = useState(aufgabeId === null)
  const [kompetenzIds, setKompetenzIds] = useState<Set<string>>(new Set())
  const [kompetenzIdsAlt, setKompetenzIdsAlt] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!aufgabeId) return
    void supabase
      .from('aufgabe_kompetenzen')
      .select('kompetenz_id')
      .eq('aufgabe_id', aufgabeId)
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((z) => z.kompetenz_id as string))
        setKompetenzIds(ids)
        setKompetenzIdsAlt(ids)
      })
    void supabase
      .from('aufgaben')
      .select('*')
      .eq('id', aufgabeId)
      .single()
      .then(({ data, error }) => {
        if (error) return setFehler(fehlerText(error))
        const a = data as Aufgabe
        setTyp(a.typ)
        setDarstellung(a.inhalt.darstellung ?? 'antippen')
        setTitel(a.titel)
        setAnweisung(a.anweisung)
        setHinweis(a.hinweis ?? '')
        setRueckmeldung(a.rueckmeldung_fehler ?? '')
        setSchwierigkeit(a.schwierigkeit)
        setGrossKlein(a.inhalt.gross_klein_beachten)
        setText(a.inhalt.text ?? teileZuText(a.inhalt.teile))
        setGeladen(true)
      })
  }, [aufgabeId])

  const { teile, fehler: textFehler } = useMemo(() => textZuTeilen(text), [text])
  const inhalt = { text, gross_klein_beachten: grossKlein, darstellung, teile }
  const format = FORMATE[typ]
  const BEISPIEL = format.beispiel
  const hatLuecke = teile.some((t) => t.t === 'luecke')
  const hatAuswahl = teile.some((t) => t.t === 'auswahl')

  async function speichern() {
    setFehler(null)
    if (!titel.trim()) return setFehler('Bitte einen Titel eingeben.')
    if (textFehler.length) return setFehler('Der Aufgabentext hat noch Fehler (siehe oben).')
    const datensatz = {
      typ,
      titel: titel.trim(),
      anweisung: anweisung.trim(),
      hinweis: hinweis.trim() || null,
      rueckmeldung_fehler: rueckmeldung.trim() || null,
      schwierigkeit,
      inhalt,
      geaendert_am: new Date().toISOString(),
    }
    const { data, error } = aufgabeId
      ? await supabase.from('aufgaben').update(datensatz).eq('id', aufgabeId).select('id').single()
      : await supabase.from('aufgaben').insert(datensatz).select('id').single()
    if (error) return setFehler(fehlerText(error))

    // Kompetenz-Zuordnung angleichen
    const entfernt = [...kompetenzIdsAlt].filter((id) => !kompetenzIds.has(id))
    const neu = [...kompetenzIds].filter((id) => !kompetenzIdsAlt.has(id))
    if (entfernt.length) {
      const r = await supabase.from('aufgabe_kompetenzen').delete().eq('aufgabe_id', data.id).in('kompetenz_id', entfernt)
      if (r.error) return setFehler(fehlerText(r.error))
    }
    if (neu.length) {
      const r = await supabase.from('aufgabe_kompetenzen').insert(neu.map((kompetenz_id) => ({ aufgabe_id: data.id, kompetenz_id })))
      if (r.error) return setFehler(fehlerText(r.error))
    }
    setKompetenzIdsAlt(new Set(kompetenzIds))
    setGespeichert(true)
    window.setTimeout(() => setGespeichert(false), 2500)
    if (!aufgabeId) gehe(`/lehrkraft/aufgaben/${data.id}`)
  }

  async function loeschen() {
    if (!aufgabeId) return
    const ok = window.confirm(
      'Diese Aufgabe endgültig löschen?\n\nSie verschwindet aus allen Paketen, und alle Versuche der Schüler:innen zu dieser Aufgabe werden gelöscht.',
    )
    if (!ok) return
    const { error } = await supabase.from('aufgaben').delete().eq('id', aufgabeId)
    if (error) setFehler(fehlerText(error))
    else gehe('/lehrkraft/aufgaben')
  }

  if (!geladen) return fehler ? <p className="hinweis-box">{fehler}</p> : <p>Lädt …</p>

  return (
    <>
      <a className="aes-btn aes-btn--ghost zurueck" href="#/lehrkraft/aufgaben">
        ← Alle Aufgaben
      </a>
      <h1>{aufgabeId ? `${format.name} bearbeiten` : `Neue Aufgabe: ${format.name}`}</h1>

      <div className="umschalter" role="tablist">
        <button role="tab" aria-selected={!vorschau} onClick={() => setVorschau(false)}>
          Bearbeiten
        </button>
        <button role="tab" aria-selected={vorschau} onClick={() => setVorschau(true)} disabled={textFehler.length > 0}>
          Vorschau (so sehen es Schüler:innen)
        </button>
      </div>

      {vorschau ? (
        <div className="vorschau-rahmen">
          <AufgabeBearbeiten
            key={JSON.stringify(inhalt)}
            aufgabe={{
              id: aufgabeId ?? 'vorschau',
              typ,
              titel: titel || '(ohne Titel)',
              anweisung,
              hinweis: hinweis || null,
              schwierigkeit,
              inhalt: ohneLoesung(teile, darstellung),
              versuche: 0,
              geloest: false,
              loesung_angesehen: false,
            }}
            pruefen={vorschauPruefen(typ, inhalt, rueckmeldung)}
          />
          <p className="klein">In der Vorschau wird nichts gespeichert.</p>
        </div>
      ) : (
        <form
          className="formular"
          onSubmit={(e) => {
            e.preventDefault()
            void speichern()
          }}
        >
          <label>
            Titel (sehen auch die Schüler:innen)
            <input value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={120} placeholder="z. B. das oder dass?" />
          </label>
          <label>
            Arbeitsanweisung
            <input value={anweisung} onChange={(e) => setAnweisung(e.target.value)} />
          </label>

          <fieldset>
            <legend>Schwierigkeit</legend>
            <div className="umschalter">
              {SCHWIERIGKEITEN.map((s) => (
                <button type="button" key={s.wert} aria-pressed={schwierigkeit === s.wert} onClick={() => setSchwierigkeit(s.wert)}>
                  {s.text}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Aufgabentext</legend>
            <div className="umschalter" role="tablist">
              <button type="button" role="tab" aria-selected={modus === 'text'} onClick={() => setModus('text')}>
                Als Text mit [Klammern]
              </button>
              <button type="button" role="tab" aria-selected={modus === 'formular'} onClick={() => setModus('formular')}>
                Per Formular
              </button>
            </div>

            {modus === 'text' ? (
              <>
                <div className="erklaerung">
                  {typ === 'auswahl' ? (
                    <p>
                      Setzen Sie jede Auswahl in <strong>[eckige Klammern]</strong>, trennen Sie die Möglichkeiten mit{' '}
                      <strong>|</strong> und markieren Sie die richtige mit <strong>*</strong>. Mehrere <strong>*</strong> ergeben
                      eine Mehrfachauswahl. Lücken zum Eintippen (<code>[Lösung]</code>) können Sie dazwischen mischen.
                    </p>
                  ) : (
                    <p>
                      Schreiben Sie den Text und setzen Sie jedes gesuchte Wort in <strong>[eckige Klammern]</strong>. Gibt es
                      mehrere richtige Lösungen, trennen Sie sie mit <strong>/</strong>. Eine Auswahl zum Antippen schreiben
                      Sie so: <code>[das | *dass]</code>.
                    </p>
                  )}
                  <p>
                    Beispiel: <code className="beispiel-code">{BEISPIEL}</code>{' '}
                    <button type="button" className="aes-btn aes-btn--ghost aes-btn--klein" onClick={() => setText(BEISPIEL)}>
                      Beispiel einfügen
                    </button>
                  </p>
                </div>
                <textarea
                  rows={7}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={BEISPIEL}
                  spellCheck={false}
                  aria-label="Aufgabentext"
                />
              </>
            ) : (
              <FormularModus teile={teile} onChange={setText} />
            )}

            {text && textFehler.length > 0 && (
              <ul className="hinweis-box">
                {textFehler.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {text && textFehler.length === 0 && (
              <p className="klein">
                ✓ {teile.filter((t) => t.t === 'luecke').length} Lücke(n) und {teile.filter((t) => t.t === 'auswahl').length}{' '}
                Auswahl-Stelle(n) erkannt.
              </p>
            )}

            {hatLuecke && (
              <label className="haken">
                <input type="checkbox" checked={grossKlein} onChange={(e) => setGrossKlein(e.target.checked)} />
                Groß-/Kleinschreibung wird bewertet
              </label>
            )}
            {hatAuswahl && (
              <div>
                <p className="klein" style={{ margin: 0 }}>
                  So wählen Schüler:innen aus (Mehrfachauswahl immer per Antippen):
                </p>
                <div className="umschalter">
                  <button type="button" aria-pressed={darstellung === 'antippen'} onClick={() => setDarstellung('antippen')}>
                    Antippen
                  </button>
                  <button type="button" aria-pressed={darstellung === 'dropdown'} onClick={() => setDarstellung('dropdown')}>
                    Dropdown in der Lücke
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          <KompetenzAuswahl ausgewaehlt={kompetenzIds} onChange={setKompetenzIds} />

          <label>
            Tipp (optional – Schüler:innen können ihn aufklappen)
            <input value={hinweis} onChange={(e) => setHinweis(e.target.value)} placeholder="z. B. Kannst du „dieses“ oder „welches“ einsetzen?" />
          </label>
          <label>
            Rückmeldung bei Fehlern (optional – erscheint nach falschem Prüfen)
            <input
              value={rueckmeldung}
              onChange={(e) => setRueckmeldung(e.target.value)}
              placeholder="z. B. Denk an die Ersatzprobe: „das“ kann man durch „dieses“ ersetzen."
            />
          </label>

          {fehler && <p className="hinweis-box">{fehler}</p>}
          <div className="knopfleiste">
            <button className="aes-btn aes-btn--primary">{gespeichert ? '✓ Gespeichert' : 'Speichern'}</button>
            {aufgabeId && (
              <button type="button" className="aes-btn aes-btn--secondary knopf-gefahr" onClick={() => void loeschen()}>
                Aufgabe löschen
              </button>
            )}
          </div>
        </form>
      )}
    </>
  )
}

// Formular: Textstücke, Lücken und Auswahl-Stellen nacheinander.
// Lücken und Auswahl werden als Rohtext gehalten (z. B. "a/" oder "das | *dass"), damit man beim Tippen nichts verliert.
type Zeile = { art: 'text'; v: string } | { art: 'luecke' | 'auswahl'; roh: string }

function FormularModus({ teile, onChange }: { teile: LueckentextTeil[]; onChange: (text: string) => void }) {
  const [zeilen, setZeilen] = useState<Zeile[]>(() =>
    teile.map((t) => (t.t === 'text' ? { art: 'text', v: t.v } : { art: t.t, roh: stelleZuText(t) })),
  )

  function setzen(neu: Zeile[]) {
    setZeilen(neu)
    onChange(neu.map((z) => (z.art === 'text' ? z.v : `[${z.roh}]`)).join(''))
  }
  const aendern = (index: number, neu: Zeile) => setzen(zeilen.map((z, i) => (i === index ? neu : z)))
  let stellenNr = 0

  return (
    <div className="formular-modus">
      {zeilen.length === 0 && <p className="klein">Fügen Sie unten abwechselnd Text, Lücken und Auswahl-Stellen hinzu.</p>}
      {zeilen.map((z, i) => (
        <div key={i} className={z.art === 'text' ? 'teil' : 'teil teil-luecke'}>
          {z.art === 'text' ? (
            <label>
              Text
              <textarea rows={2} value={z.v} onChange={(e) => aendern(i, { art: 'text', v: e.target.value })} spellCheck={false} />
            </label>
          ) : z.art === 'luecke' ? (
            <label>
              Lücke {++stellenNr}: richtige Lösung(en), mehrere mit / trennen
              <input value={z.roh} onChange={(e) => aendern(i, { art: 'luecke', roh: e.target.value })} spellCheck={false} />
            </label>
          ) : (
            <label>
              Auswahl {++stellenNr}: Möglichkeiten mit | trennen, richtige mit * markieren
              <input
                value={z.roh}
                onChange={(e) => aendern(i, { art: 'auswahl', roh: e.target.value })}
                spellCheck={false}
                placeholder="das | *dass"
              />
            </label>
          )}
          <button type="button" className="aes-btn aes-btn--ghost aes-btn--klein" onClick={() => setzen(zeilen.filter((_, j) => j !== i))} aria-label="Entfernen">
            ✕
          </button>
        </div>
      ))}
      <div className="knopfleiste">
        <button type="button" className="aes-btn aes-btn--secondary aes-btn--klein" onClick={() => setzen([...zeilen, { art: 'text', v: ' ' }])}>
          + Text
        </button>
        <button type="button" className="aes-btn aes-btn--secondary aes-btn--klein" onClick={() => setzen([...zeilen, { art: 'luecke', roh: '' }])}>
          + Lücke
        </button>
        <button type="button" className="aes-btn aes-btn--secondary aes-btn--klein" onClick={() => setzen([...zeilen, { art: 'auswahl', roh: '' }])}>
          + Auswahl
        </button>
      </div>
    </div>
  )
}

// In der Vorschau prüft die Datenbank mit derselben Logik wie bei Schüler:innen – ohne zu speichern.
function vorschauPruefen(typ: AufgabenTyp, inhalt: object, rueckmeldung: string) {
  let versuche = 0
  return async (antworten: Antworten) => {
    const { data, error } = await supabase.rpc('pruefe_aufgabe', { p_typ: typ, p_inhalt: inhalt, p_antworten: antworten })
    if (error) throw new Error(fehlerText(error))
    const ergebnis = data as Pruefergebnis
    versuche++
    return { ergebnis, rueckmeldung: ergebnis.richtig ? null : rueckmeldung || null, versuche }
  }
}

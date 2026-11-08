import { useEffect, useMemo, useState } from 'react'
import { AufgabeBearbeiten } from '../gemeinsam/AufgabeBearbeiten'
import { fehlerText } from '../lib/fehler'
import {
  bloeckeZuText,
  kategorienAus,
  ohneLoesung,
  reihenZuTeilen,
  stelleZuText,
  teileZuText,
  textZuTeilen,
  versionenBloecke,
  versionenZuTeilen,
  type VersionenBlock,
} from '../lib/lueckentext'
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
  fehler: {
    name: 'Fehler finden',
    anweisung: 'Finde die Fehler im Text.',
    beispiel: 'Ich [weis -> weiß] nicht, ob mein Bruder heute [komt -> kommt]. Wir wollen [radfahren -> Rad fahren].',
  },
  reihenfolge: {
    name: 'Reihenfolge',
    anweisung: 'Bring die Bausteine in die richtige Reihenfolge.',
    beispiel:
      'Varianten: 2\ngestern | bin ich | ins Kino | gegangen.\nins Kino | bin ich | gestern | gegangen.\n\nder Hund | bellt | laut.',
  },
  ueberarbeiten: {
    name: 'Sätze verbessern',
    anweisung: 'Welche Version ist besser? Tippe sie an.',
    beispiel:
      'Kontext: Gestern war ich im Zoo.\nDann sah ich die Löwen und dann sah ich die Affen.\nHinweis: Hier steht zweimal „dann sah ich“. Das klingt eintönig.\n*Zuerst sah ich die Löwen, danach die Affen.\nHinweis: Die Wiederholung ist vermieden, der Satz ist kürzer.',
  },
  zuordnen: {
    name: 'Zuordnen',
    anweisung: 'Wähle oben eine Kategorie und tippe die passenden Wörter an.',
    beispiel: 'Der [Hund = Nomen] [läuft = Verb] [schnell = Adjektiv] über die [Wiese = Nomen].',
  },
}

// Aufgabe anlegen oder bearbeiten (alle Formate) – wahlweise als Text mit [Klammern] oder per Formular.
export function AufgabeEditor({ aufgabeId, neuerTyp = 'lueckentext' }: { aufgabeId: string | null; neuerTyp?: AufgabenTyp }) {
  const [typ, setTyp] = useState<AufgabenTyp>(neuerTyp)
  const [darstellung, setDarstellung] = useState<Darstellung>('antippen')
  // Zuordnen: selbst eingetragene Kategorien (z. B. zusätzliche „Ablenker-Kategorien“), mit Komma getrennt
  const [kategorienText, setKategorienText] = useState('')
  // Fehler finden: auch die richtige Form eintippen lassen? Anzahl der Fehler anzeigen?
  const [korrigieren, setKorrigieren] = useState(false)
  const [anzahlZeigen, setAnzahlZeigen] = useState(true)
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
        setKategorienText((a.inhalt.kategorien ?? []).join(', '))
        setKorrigieren(a.inhalt.korrigieren ?? false)
        setAnzahlZeigen(a.inhalt.anzahl_zeigen ?? true)
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

  const { teile, fehler: textFehler } = useMemo(
    () =>
      typ === 'reihenfolge'
        ? reihenZuTeilen(text)
        : typ === 'ueberarbeiten'
          ? versionenZuTeilen(text)
          : textZuTeilen(text, typ === 'fehler' ? 'fehler' : typ === 'zuordnen'),
    [text, typ],
  )
  const kategorien = typ === 'zuordnen' ? kategorienAus(teile, kategorienText.split(',')) : undefined
  const fehlerOptionen = typ === 'fehler' ? { korrigieren, anzahl_zeigen: anzahlZeigen } : {}
  const inhalt = { text, gross_klein_beachten: grossKlein, darstellung, kategorien, ...fehlerOptionen, teile }
  const format = FORMATE[typ]
  const BEISPIEL = format.beispiel
  const hatLuecke = teile.some((t) => t.t === 'luecke') || (typ === 'fehler' && korrigieren)
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
              inhalt: ohneLoesung(teile, darstellung, kategorien, fehlerOptionen),
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
                  {typ === 'ueberarbeiten' ? (
                    <p>
                      Schreiben Sie jede Version eines Satzes in eine <strong>eigene Zeile</strong> (2 bis 4 Versionen) und
                      markieren Sie die bessere mit <strong>*</strong>. Unter jede Version gehört eine Zeile{' '}
                      <code>Hinweis: …</code> mit der Begründung – Schüler:innen sehen die Hinweise erst nach dem Prüfen.
                      Optional steht darüber <code>Kontext: …</code> (z. B. der Satz davor). Eine <strong>Leerzeile</strong>{' '}
                      beginnt einen neuen Satz. Die Versionen erscheinen in der Reihenfolge, in der Sie sie schreiben.
                    </p>
                  ) : typ === 'reihenfolge' ? (
                    <p>
                      Schreiben Sie jeden Satz in die richtige Reihenfolge und trennen Sie die Bausteine mit <strong>|</strong>.
                      Gibt es weitere richtige Reihenfolgen, schreiben Sie sie in die Zeilen <strong>direkt darunter</strong>.
                      Eine <strong>Leerzeile</strong> beginnt einen neuen Satz. Schreiben Sie das erste Wort so, wie es mitten
                      im Satz stünde (z. B. <code>gestern</code>), und setzen Sie das Satzzeichen ans Ende. Schüler:innen
                      sehen Bausteine gemischt, ohne großen Satzanfang und ohne Satzzeichen – beides erscheint erst, wenn der
                      Satz richtig ist. Die Satzart wird aus dem Satzzeichen erkannt (. ? !); sonst eine Zeile{' '}
                      <code>Satzart: Ausrufesatz</code> darüber schreiben. Sollen mehrere richtige Sätze gebildet werden,
                      schreiben Sie z. B. <code>Varianten: 2</code> darüber.
                    </p>
                  ) : typ === 'fehler' ? (
                    <p>
                      Schreiben Sie den Text und setzen Sie jedes Fehlerwort so in Klammern:{' '}
                      <strong>[Fehlerwort -&gt; Verbesserung]</strong>, z. B. <code>[weis -&gt; weiß]</code>. Mehrere richtige
                      Verbesserungen trennen Sie mit <strong>/</strong>. Für Zeichensetzung markieren Sie das Wort davor, z. B.{' '}
                      <code>[weiß -&gt; weiß,]</code>. Alle übrigen Wörter sind ebenfalls antippbar, aber fehlerfrei.
                    </p>
                  ) : typ === 'zuordnen' ? (
                    <p>
                      Schreiben Sie den Satz und setzen Sie jedes Wort oder jede Wortgruppe, die zugeordnet werden soll, so in
                      Klammern: <strong>[Wort = Kategorie]</strong>, z. B. <code>[Der kleine Hund = Subjekt]</code>. Alle
                      übrigen Wörter sind für Schüler:innen ebenfalls antippbar, gehören aber zu keiner Kategorie.
                    </p>
                  ) : typ === 'auswahl' ? (
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
              typ === 'reihenfolge' ? (
                <ReihenFormular text={text} onChange={setText} />
              ) : typ === 'ueberarbeiten' ? (
                <VersionenFormular text={text} onChange={setText} />
              ) : (
                <FormularModus teile={teile} onChange={setText} />
              )
            )}

            {text && textFehler.length > 0 && (
              <ul className="hinweis-box">
                {textFehler.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {text && textFehler.length === 0 && (typ === 'reihenfolge' || typ === 'ueberarbeiten') && (
              <p className="klein">
                ✓ {teile.length === 1 ? '1 Satz' : `${teile.length} Sätze`} {typ === 'reihenfolge' ? 'zum Ordnen' : 'mit Versionen'}{' '}
                erkannt.
              </p>
            )}
            {text && textFehler.length === 0 && typ !== 'reihenfolge' && typ !== 'ueberarbeiten' && (
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
            {typ === 'fehler' && (
              <div>
                <div className="umschalter">
                  <button type="button" aria-pressed={!korrigieren} onClick={() => setKorrigieren(false)}>
                    Nur Fehler finden
                  </button>
                  <button type="button" aria-pressed={korrigieren} onClick={() => setKorrigieren(true)}>
                    Finden und verbessern (eintippen)
                  </button>
                </div>
                <label className="haken">
                  <input type="checkbox" checked={anzahlZeigen} onChange={(e) => setAnzahlZeigen(e.target.checked)} />
                  Anzahl der Fehler anzeigen („Finde {teile.filter((t) => t.t === 'wort' && t.korrekturen).length} Fehler“)
                </label>
              </div>
            )}
            {typ === 'zuordnen' && (
              <label>
                Kategorien („Stifte“) – die im Text verwendeten kommen automatisch dazu. Weitere als Ablenker mit Komma trennen:
                <input
                  value={kategorienText}
                  onChange={(e) => setKategorienText(e.target.value)}
                  placeholder="z. B. Nomen, Verb, Adjektiv, Artikel"
                />
                {kategorien && kategorien.length > 0 && <span className="klein">Schüler:innen sehen: {kategorien.join(' · ')}</span>}
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

// Formular: Textstücke, Lücken, Auswahl-Stellen und Zuordnungen nacheinander.
// Sie werden als Rohtext gehalten (z. B. "a/", "das | *dass", "Hund = Nomen"), damit man beim Tippen nichts verliert.
type Zeile = { art: 'text'; v: string } | { art: 'luecke' | 'auswahl' | 'einheit' | 'wort'; roh: string }

// Wörter ohne Kategorie (Ablenker) gehören im Formular zum normalen Text; benachbarte Textstücke werden zusammengefasst.
function zeilenAus(teile: LueckentextTeil[]): Zeile[] {
  const zeilen: Zeile[] = []
  for (const t of teile) {
    const text = t.t === 'text' ? t.v : (t.t === 'einheit' && !t.kategorie) || (t.t === 'wort' && !t.korrekturen) ? t.v : null
    const letzte = zeilen[zeilen.length - 1]
    if (text !== null) {
      if (letzte && letzte.art === 'text') zeilen[zeilen.length - 1] = { art: 'text', v: letzte.v + text }
      else zeilen.push({ art: 'text', v: text })
    } else if (t.t !== 'text' && t.t !== 'reihe' && t.t !== 'versionen') {
      zeilen.push({ art: t.t, roh: stelleZuText(t) })
    }
  }
  return zeilen
}

function FormularModus({ teile, onChange }: { teile: LueckentextTeil[]; onChange: (text: string) => void }) {
  const [zeilen, setZeilen] = useState<Zeile[]>(() => zeilenAus(teile))

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
          ) : z.art === 'wort' ? (
            <label>
              Fehler {++stellenNr}: Fehlerwort -&gt; Verbesserung (mehrere Verbesserungen mit / trennen)
              <input
                value={z.roh}
                onChange={(e) => aendern(i, { art: 'wort', roh: e.target.value })}
                spellCheck={false}
                placeholder="weis -> weiß"
              />
            </label>
          ) : z.art === 'einheit' ? (
            <label>
              Zuordnung {++stellenNr}: Wort oder Wortgruppe = Kategorie
              <input
                value={z.roh}
                onChange={(e) => aendern(i, { art: 'einheit', roh: e.target.value })}
                spellCheck={false}
                placeholder="Der kleine Hund = Subjekt"
              />
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
        <button type="button" className="aes-btn aes-btn--secondary aes-btn--klein" onClick={() => setzen([...zeilen, { art: 'einheit', roh: '' }])}>
          + Zuordnung
        </button>
        <button type="button" className="aes-btn aes-btn--secondary aes-btn--klein" onClick={() => setzen([...zeilen, { art: 'wort', roh: '' }])}>
          + Fehler
        </button>
      </div>
    </div>
  )
}

// Formular für „Reihenfolge“: je Satz Satzart, Anzahl Varianten und ein Feld mit den Reihenfolgen.
type SatzFeld = { satzart: string; varianten: number; zeilen: string }
const SATZARTEN = ['Aussagesatz', 'Fragesatz', 'Aufforderungssatz', 'Ausrufesatz']

function satzFeldAus(block: string): SatzFeld {
  const feld: SatzFeld = { satzart: '', varianten: 1, zeilen: '' }
  const zeilen: string[] = []
  for (const z of block.split('\n')) {
    const art = /^\s*satzart\s*:\s*(.*)$/i.exec(z)
    const anzahl = /^\s*varianten\s*:\s*(.*)$/i.exec(z)
    if (art) feld.satzart = art[1].trim()
    else if (anzahl) feld.varianten = Number(anzahl[1]) || 1
    else zeilen.push(z)
  }
  feld.zeilen = zeilen.join('\n')
  return feld
}

function satzFeldZuText(f: SatzFeld): string {
  return [...(f.varianten > 1 ? [`Varianten: ${f.varianten}`] : []), ...(f.satzart ? [`Satzart: ${f.satzart}`] : []), f.zeilen.trim()]
    .join('\n')
    .trim()
}

function ReihenFormular({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const [saetze, setSaetze] = useState<SatzFeld[]>(() => {
    const liste = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    return (liste.length ? liste : ['']).map(satzFeldAus)
  })
  function setzen(neu: SatzFeld[]) {
    setSaetze(neu)
    onChange(neu.filter((s) => s.zeilen.trim()).map(satzFeldZuText).join('\n\n'))
  }
  const aendern = (i: number, teil: Partial<SatzFeld>) => setzen(saetze.map((x, j) => (j === i ? { ...x, ...teil } : x)))
  return (
    <div className="formular-modus">
      {saetze.map((s, i) => (
        <div key={i} className="teil teil-luecke">
          <label>
            Satz {i + 1}: Satzart
            <select value={s.satzart} onChange={(e) => aendern(i, { satzart: e.target.value })}>
              <option value="">automatisch (aus . ? !)</option>
              {[...SATZARTEN, ...(s.satzart && !SATZARTEN.includes(s.satzart) ? [s.satzart] : [])].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wie viele verschiedene richtige Sätze sollen gebildet werden?
            <input
              type="number"
              min={1}
              max={10}
              value={s.varianten}
              onChange={(e) => aendern(i, { varianten: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </label>
          <label>
            Bausteine in richtiger Reihenfolge, mit | getrennt, Satzzeichen ans Ende. Weitere richtige Reihenfolgen in neue Zeilen.
            <textarea
              rows={2}
              value={s.zeilen}
              onChange={(e) => aendern(i, { zeilen: e.target.value.replace(/\n\s*\n/g, '\n') })}
              spellCheck={false}
              placeholder="gestern | bin ich | ins Kino | gegangen."
            />
          </label>
          <button
            type="button"
            className="aes-btn aes-btn--ghost aes-btn--klein"
            onClick={() => setzen(saetze.filter((_, j) => j !== i))}
            aria-label={`Satz ${i + 1} entfernen`}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="knopfleiste">
        <button type="button" className="aes-btn aes-btn--secondary aes-btn--klein" onClick={() => setSaetze([...saetze, satzFeldAus('')])}>
          + Satz
        </button>
      </div>
    </div>
  )
}

// Formular für „Sätze verbessern“: je Satz Kontext und 2–4 Versionen mit Hinweis; die bessere per Auswahlknopf.
const leereVersion = () => ({ text: '', hinweis: '', besser: false })

function VersionenFormular({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const [bloecke, setBloecke] = useState<VersionenBlock[]>(() => {
    const liste = versionenBloecke(text)
    return liste.length ? liste : [{ kontext: '', versionen: [leereVersion(), leereVersion()] }]
  })
  function setzen(neu: VersionenBlock[]) {
    setBloecke(neu)
    onChange(bloeckeZuText(neu))
  }
  const blockAendern = (i: number, b: VersionenBlock) => setzen(bloecke.map((x, j) => (j === i ? b : x)))
  return (
    <div className="formular-modus">
      {bloecke.map((b, i) => (
        <fieldset key={i} className="teil teil-luecke versionen-formular">
          <legend>Satz {i + 1}</legend>
          <label>
            Kontext (optional, z. B. der Satz davor)
            <input value={b.kontext} onChange={(e) => blockAendern(i, { ...b, kontext: e.target.value })} />
          </label>
          {b.versionen.map((v, j) => {
            const versionAendern = (neu: Partial<typeof v>) =>
              blockAendern(i, { ...b, versionen: b.versionen.map((x, k) => (k === j ? { ...x, ...neu } : x)) })
            return (
              <div key={j} className="versionen-formular__version">
                <label className="haken">
                  <input
                    type="radio"
                    name={`besser-${i}`}
                    checked={v.besser}
                    onChange={() => blockAendern(i, { ...b, versionen: b.versionen.map((x, k) => ({ ...x, besser: k === j })) })}
                  />
                  Version {j + 1} ist die bessere
                </label>
                <label>
                  Version {j + 1}
                  <input value={v.text} onChange={(e) => versionAendern({ text: e.target.value })} />
                </label>
                <label>
                  Hinweis zu Version {j + 1} (erscheint nach dem Prüfen)
                  <input value={v.hinweis} onChange={(e) => versionAendern({ hinweis: e.target.value })} />
                </label>
                {b.versionen.length > 2 && (
                  <button
                    type="button"
                    className="aes-btn aes-btn--ghost aes-btn--klein"
                    onClick={() => blockAendern(i, { ...b, versionen: b.versionen.filter((_, k) => k !== j) })}
                  >
                    Version {j + 1} entfernen
                  </button>
                )}
              </div>
            )
          })}
          <div className="knopfleiste">
            {b.versionen.length < 4 && (
              <button
                type="button"
                className="aes-btn aes-btn--secondary aes-btn--klein"
                onClick={() => blockAendern(i, { ...b, versionen: [...b.versionen, leereVersion()] })}
              >
                + Version
              </button>
            )}
            <button
              type="button"
              className="aes-btn aes-btn--ghost aes-btn--klein"
              onClick={() => setzen(bloecke.filter((_, j) => j !== i))}
            >
              Satz {i + 1} entfernen
            </button>
          </div>
        </fieldset>
      ))}
      <div className="knopfleiste">
        <button
          type="button"
          className="aes-btn aes-btn--secondary aes-btn--klein"
          onClick={() => setBloecke([...bloecke, { kontext: '', versionen: [leereVersion(), leereVersion()] }])}
        >
          + Satz
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

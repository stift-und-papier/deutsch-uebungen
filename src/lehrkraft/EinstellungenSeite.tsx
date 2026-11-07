import { useEffect, useState } from 'react'
import { fehlerText } from '../lib/fehler'
import type { Einstellungen, RueckmeldeText } from '../lib/lernstand'
import { supabase } from '../lib/supabase'

const TEXT_FELDER: { feld: RueckmeldeText; titel: string; hilfe: string }[] = [
  { feld: 'deutlich', titel: '🚀 Deutlich besser', hilfe: 'mindestens 2 Stufen besser als beim Vergleich' },
  { feld: 'besser', titel: '📈 Wird besser', hilfe: 'besser als beim Vergleich' },
  { feld: 'dranbleiben', titel: '💪 Dranbleiben', hilfe: 'gleich geblieben oder schwächer (wird nie als „schlechter“ gezeigt)' },
  { feld: 'erste', titel: '🌱 Erste Ergebnisse', hilfe: 'noch zu wenige Versuche für eine Aussage' },
  { feld: 'gelungen', titel: 'Was schon gelingt', hilfe: '{anzahl} = Zahl gelöster Aufgaben, {aufgaben} = „Aufgabe“ oder „Aufgaben“' },
  { feld: 'naechster_schritt', titel: 'Nächster Schritt', hilfe: 'davor steht der Name der Kompetenz mit dem meisten Übungsbedarf' },
]

// Einstellungen für Lernstand und Rückmeldetexte.
export function EinstellungenSeite() {
  const [e, setE] = useState<Einstellungen | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)

  useEffect(() => {
    void supabase
      .from('einstellungen')
      .select('*')
      .single()
      .then(({ data, error }) => (error ? setFehler(fehlerText(error)) : setE(data as Einstellungen)))
  }, [])

  if (!e) return fehler ? <p className="hinweis-box">{fehler}</p> : <p>Lädt …</p>

  const zahl = (feld: keyof Einstellungen) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setE({ ...e, [feld]: ev.target.value === '' ? null : Number(ev.target.value) })
  const text = (feld: RueckmeldeText) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setE({ ...e, texte: { ...e.texte, [feld]: ev.target.value } })

  return (
    <form
      className="formular"
      onSubmit={async (ev) => {
        ev.preventDefault()
        const { owner, ...rest } = e
        const { error } = await supabase.from('einstellungen').update(rest).eq('owner', owner)
        if (error) {
          setFehler(/check/i.test(error.message) ? 'Bitte die Grenzen aufsteigend wählen (z. B. 35 < 55 < 70 < 85).' : fehlerText(error))
        } else {
          setFehler(null)
          setGespeichert(true)
          window.setTimeout(() => setGespeichert(false), 2500)
        }
      }}
    >
      <h1>Einstellungen</h1>

      <section className="kasten">
        <h2>Rückmeldetexte für Schüler:innen</h2>
        <p className="klein">Schüler:innen sehen nur diese Texte – nie Stufen, Punkte oder Prozente.</p>
        {TEXT_FELDER.map((t) => (
          <label key={t.feld}>
            {t.titel} <span className="klein">({t.hilfe})</span>
            <input value={e.texte[t.feld] ?? ''} onChange={text(t.feld)} required />
          </label>
        ))}
      </section>

      <section className="kasten">
        <h2>Berechnung des Stands</h2>
        <p className="klein">
          So funktioniert es: Pro Kompetenz zählen die letzten gewerteten Versuche (pro Aufgabe und Tag nur der erste,
          nicht nach „Lösung ansehen“). Jeder Versuch bringt „Anteil richtig × Höchstpunkte der Schwierigkeit“. Neuere
          Versuche zählen mehr. Aus dem Durchschnitt (0–100) ergibt sich die Stufe.
        </p>
        <div className="formular zeile">
          <label>
            Mindestanzahl Versuche
            <input type="number" min={1} max={50} value={e.min_versuche} onChange={zahl('min_versuche')} />
          </label>
          <label>
            Berücksichtigte letzte Versuche
            <input type="number" min={3} max={100} value={e.anzahl_letzte} onChange={zahl('anzahl_letzte')} />
          </label>
          <label>
            Gewicht älterer Versuche (0,5–1)
            <input type="number" min={0.5} max={1} step={0.05} value={e.abklingen} onChange={zahl('abklingen')} />
          </label>
        </div>
        <div className="formular zeile">
          <label>
            Höchstpunkte leicht
            <input type="number" min={1} max={100} value={e.punkte_leicht} onChange={zahl('punkte_leicht')} />
          </label>
          <label>
            mittel
            <input type="number" min={1} max={100} value={e.punkte_mittel} onChange={zahl('punkte_mittel')} />
          </label>
          <label>
            schwer
            <input type="number" min={1} max={100} value={e.punkte_schwer} onChange={zahl('punkte_schwer')} />
          </label>
        </div>
        <p className="klein">Stufengrenzen (Punkte ab denen die Stufe gilt):</p>
        <div className="formular zeile">
          <label>
            „-“ ab
            <input type="number" value={e.grenze_minus} onChange={zahl('grenze_minus')} />
          </label>
          <label>
            „o“ ab
            <input type="number" value={e.grenze_o} onChange={zahl('grenze_o')} />
          </label>
          <label>
            „+“ ab
            <input type="number" value={e.grenze_plus} onChange={zahl('grenze_plus')} />
          </label>
          <label>
            „++“ ab
            <input type="number" value={e.grenze_plusplus} onChange={zahl('grenze_plusplus')} />
          </label>
        </div>
      </section>

      <section className="kasten">
        <h2>Entwicklung (Trend)</h2>
        <p className="klein">
          Ein Trend wird nur gezeigt, wenn seit dem Vergleich genug neue Versuche dazugekommen sind UND sich der Stand
          deutlich verändert hat. So wird Zufall nicht als Fortschritt gedeutet.
        </p>
        <div className="formular zeile">
          <label>
            Mindestens neue Versuche
            <input type="number" min={1} max={50} value={e.trend_min_neue} onChange={zahl('trend_min_neue')} />
          </label>
          <label>
            Mindest-Veränderung (Punkte)
            <input type="number" min={1} max={100} value={e.trend_min_diff} onChange={zahl('trend_min_diff')} />
          </label>
          <label>
            Vergleichen mit Stand vor … Wochen (leer = Startstand)
            <input type="number" min={1} max={52} value={e.vergleich_wochen ?? ''} onChange={zahl('vergleich_wochen')} />
          </label>
        </div>
      </section>

      <section className="kasten">
        <h2>Blumenwiese der Schüler:innen</h2>
        <p className="klein">
          Auf ihrer Startseite sehen Schüler:innen eine Wiese, die mit ihrer Entwicklung blüht (höchstens 80 Blumen). Die
          Zahl hängt nur von der Entwicklung ab, nie vom Stand (-- bis ++). Die Wiese welkt nie: Gezeigt wird immer der
          bisher höchste Wert. Schüler:innen sehen keine Zahl, nur die Wiese und einen Satz.
        </p>
        <p className="klein">Blumen je Kompetenz, wenn dort steht …</p>
        <div className="formular zeile">
          <label>
            „deutlich besser“
            <input type="number" min={0} max={10} value={e.wiese_stark} onChange={zahl('wiese_stark')} />
          </label>
          <label>
            „wird besser“
            <input type="number" min={0} max={10} value={e.wiese_gut} onChange={zahl('wiese_gut')} />
          </label>
          <label>
            „lohnt sich noch Übung“
            <input type="number" min={0} max={10} value={e.wiese_dran} onChange={zahl('wiese_dran')} />
          </label>
          <label>
            „erste Ergebnisse“
            <input type="number" min={0} max={10} value={e.wiese_sammeln} onChange={zahl('wiese_sammeln')} />
          </label>
        </div>
        <div className="formular zeile">
          <label>
            Blumen je abgeschlossenem Übungspaket
            <input type="number" min={0} max={10} value={e.wiese_je_paket} onChange={zahl('wiese_je_paket')} />
          </label>
          <label>
            höchstens durch Pakete
            <input type="number" min={0} max={80} value={e.wiese_pakete_max} onChange={zahl('wiese_pakete_max')} />
          </label>
        </div>
      </section>

      {fehler && <p className="hinweis-box">{fehler}</p>}
      <div className="knopfleiste">
        <button className="aes-btn aes-btn--primary">{gespeichert ? '✓ Gespeichert' : 'Speichern'}</button>
      </div>
    </form>
  )
}

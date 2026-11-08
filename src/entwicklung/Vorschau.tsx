// Nur für die Entwicklung (npm run dev): zeigt Lehrkraft-Ansichten mit erfundenen Beispieldaten,
// damit sie ohne Anmeldung geprüft werden können. Diese Datei landet NICHT in der veröffentlichten App
// (sie wird nur geladen, wenn import.meta.env.DEV wahr ist).
import { useState } from 'react'
import { Blumenwiese, wieseSatz } from '../gemeinsam/Blumenwiese'
import { AufgabeEditor, formatAusAdresse } from '../lehrkraft/AufgabeEditor'
import { FormatWahl } from '../lehrkraft/FormatWahl'
import { AuswertungAnsicht } from '../lehrkraft/KlassenLernstand'
import { KlassenListe } from '../lehrkraft/KlassenListe'
import { LehrkraftRahmen } from '../lehrkraft/LehrkraftBereich'
import { usePfad } from '../lib/router'
import type { Auswertung, Einstellungen } from '../lib/lernstand'
import type { Klasse, Kompetenz, Schueler } from '../lib/typen'

const e: Einstellungen = {
  owner: 'x',
  min_versuche: 4,
  anzahl_letzte: 10,
  abklingen: 0.85,
  punkte_leicht: 70,
  punkte_mittel: 85,
  punkte_schwer: 100,
  grenze_minus: 35,
  grenze_o: 55,
  grenze_plus: 70,
  grenze_plusplus: 85,
  trend_min_neue: 4,
  trend_min_diff: 15,
  vergleich_wochen: null,
  wiese_sammeln: 0,
  wiese_dran: 1,
  wiese_gut: 2,
  wiese_stark: 3,
  wiese_je_paket: 1,
  wiese_pakete_max: 20,
  texte: { deutlich: '', besser: '', dranbleiben: '', erste: '', gelungen: '', naechster_schritt: '' },
}

const klasse: Klasse = { id: 'k', name: '7a (Beispiel)', jahrgang: 7, kerncurriculum: 'Realschule', erstellt_am: '' }
const namen = ['Dachs-09', 'Eule-12', 'Fuchs-07', 'Hase-05', 'Igel-03', 'Luchs-11']
const schueler: Schueler[] = namen.map((p, i) => ({
  id: `s${i}`,
  klasse_id: 'k',
  pseudonym: p,
  token: '',
  kerncurriculum: 'Realschule',
  erstellt_am: '',
}))
const kNamen = ['s-Laute und Vokallänge', 'Großschreibung', 'Komma bei Aufzählung und Nebensatz', 'Satzglieder', 'das oder dass']
const kompetenzen: Kompetenz[] = kNamen.map((n, i) => ({
  id: `k${i}`,
  code: `X-${i}`,
  kerncurriculum: 'Realschule',
  bereich: i < 2 ? 'Rechtschreibung' : i === 3 ? 'Satzglieder und Sätze' : 'Zeichensetzung',
  stufe: '6',
  kompetenz: 'Wortlaut aus dem Kerncurriculum (Beispiel)',
  hinweis: null,
  kurzname: n,
  ausgeblendet: false,
  sortierung: i,
}))

// Stufe je Schüler:in und Kompetenz (null = noch nicht genug Daten), Startstufe, Trend in Stufen
const tabelle: [number | null, number | null, number | null][][] = [
  [[2, 2, null], [2, 1, null], [3, 2, null], [3, 3, null], [2, 2, null]],
  [[3, 2, null], [4, 3, null], [3, 3, null], [2, 2, null], [3, 1, 2]],
  [[4, 1, 3], [3, 2, 1], [2, 1, 1], [1, 1, null], [null, null, null]],
  [[2, 2, null], [1, 1, null], [0, 0, null], [2, 1, null], [1, 1, null]],
  [[1, 0, 1], [0, 0, null], [1, 1, null], [2, 2, null], [null, null, null]],
  [[2, 2, null], [3, 2, null], [2, 3, -1], [1, 1, null], [1, 1, null]],
]

function auswertung([stufe, start, trend]: [number | null, number | null, number | null]): Auswertung {
  const p = (s: number) => [20, 45, 62, 77, 92][s]
  const verlauf = stufe === null ? null : Array.from({ length: 7 }, (_, i) => ({
    zeit: new Date(2026, 8, 15 + i * 7).toISOString(),
    punkte: p(start ?? 0) + ((p(stufe) - p(start ?? 0)) * i) / 6,
  }))
  return {
    punkte: stufe === null ? null : p(stufe),
    stufe,
    anzahl: stufe === null ? 2 : 9,
    start_punkte: start === null ? null : p(start),
    start_stufe: start,
    start_zeit: '2026-09-15T10:00:00Z',
    vergleich_punkte: start === null ? null : p(start),
    vergleich_stufe: start,
    vergleich_zeit: stufe === null ? null : '2026-10-12T10:00:00Z',
    neue_seit_vergleich: trend === null ? 2 : 6,
    trend_gueltig: trend !== null,
    trend_punkte: trend === null ? null : trend * 16,
    trend_stufen: trend,
    verlauf,
  }
}

const werte = schueler.flatMap((s, i) =>
  kompetenzen.map((k, j) => ({ schueler_id: s.id, kompetenz_id: k.id, daten: auswertung(tabelle[i][j]) })),
)

// #/vorschau            → Auswertung mit Beispieldaten
// #/vorschau/klassen    → Klassenliste (ohne Anmeldung leer)
// #/vorschau/aufgabe    → Formular „Neuer Lückentext“
export function Vorschau() {
  const [, seite = 'auswertung', teil] = usePfad()
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>('s2')
  // #/vorschau/wiese/30 → Blumenwiese mit 30 Blumen (Füllstände prüfen)
  if (seite === 'wiese') {
    const zahl = Number(teil) || 0
    return (
      <div className="wiese rahmen" style={{ gridTemplateColumns: '1fr' }}>
        <section className="aes-card wiese-karte">
          <Blumenwiese blumen={zahl} />
          <div className="wiese-karte__text">
            <h2 className="aes-card__title">Vorschau: {zahl} Blumen</h2>
            <p className="seitenkopf__text">{wieseSatz(zahl)}</p>
          </div>
        </section>
      </div>
    )
  }
  if (seite === 'klassen')
    return (
      <LehrkraftRahmen bereich="klassen" eigeneKarten={false}>
        <KlassenListe />
      </LehrkraftRahmen>
    )
  if (seite === 'formate')
    return (
      <LehrkraftRahmen bereich="aufgaben" eigeneKarten={false}>
        <FormatWahl />
      </LehrkraftRahmen>
    )
  if (seite === 'aufgabe' || formatAusAdresse(`neu-${seite}`))
    return (
      <LehrkraftRahmen bereich="aufgaben" eigeneKarten={false}>
        <AufgabeEditor aufgabeId={null} neuerTyp={formatAusAdresse(`neu-${seite}`) ?? 'lueckentext'} />
      </LehrkraftRahmen>
    )
  return (
    <LehrkraftRahmen bereich="klassen" eigeneKarten>
      <AuswertungAnsicht
        klasse={klasse}
        schueler={schueler}
        kompetenzen={kompetenzen}
        werte={werte}
        einstellungen={e}
        ausgewaehlt={ausgewaehlt}
        onAuswahl={setAusgewaehlt}
      />
    </LehrkraftRahmen>
  )
}

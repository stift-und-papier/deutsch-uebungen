import { JAHRGAENGE, ZWEIGE, type Paket } from '../lib/typen'

type Tags = Pick<Paket, 'jahrgaenge' | 'zweige'>

/** Sichtbare Tags eines Pakets: erst die Jahrgänge (aufsteigend), dann die Zweige in fester Reihenfolge */
export function PaketTags({ jahrgaenge, zweige }: Tags) {
  const tags = [
    ...JAHRGAENGE.filter((j) => jahrgaenge.includes(j)).map((j) => `Jg. ${j}`),
    ...ZWEIGE.filter((z) => zweige.includes(z)),
  ]
  if (tags.length === 0) return null
  return (
    <ul className="paket-tags" aria-label="Tags">
      {tags.map((t) => (
        <li key={t} className="marke">
          {t}
        </li>
      ))}
    </ul>
  )
}

/** Ankreuzfelder für die Tags (beim Anlegen und beim Bearbeiten eines Pakets) */
export function TagAuswahl({ wert, onChange }: { wert: Tags; onChange: (t: Tags) => void }) {
  const umschalten = <T,>(liste: T[], x: T) => (liste.includes(x) ? liste.filter((y) => y !== x) : [...liste, x])
  return (
    <div className="tag-auswahl">
      <fieldset>
        <legend>Jahrgang</legend>
        {JAHRGAENGE.map((j) => (
          <label key={j} className="haken">
            <input type="checkbox" checked={wert.jahrgaenge.includes(j)} onChange={() => onChange({ ...wert, jahrgaenge: umschalten(wert.jahrgaenge, j) })} />
            {j}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Zweig</legend>
        {ZWEIGE.map((z) => (
          <label key={z} className="haken">
            <input type="checkbox" checked={wert.zweige.includes(z)} onChange={() => onChange({ ...wert, zweige: umschalten(wert.zweige, z) })} />
            {z}
          </label>
        ))}
      </fieldset>
    </div>
  )
}

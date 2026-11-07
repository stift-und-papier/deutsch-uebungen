// Erzeugt aus docs/kompetenzen.csv einen SQL-Befehl zum Import in die Datenbank.
// Aufruf:  node scripts/kompetenzen-sql.ts <owner-uuid> > ausgabe.sql
// Bereits vorhandene Kompetenzen (gleiche id/code) werden NICHT überschrieben.
import { readFileSync } from 'node:fs'
import { kompetenzenAusCsv } from '../src/lib/csv.ts'

const owner = process.argv[2]
if (!/^[0-9a-f-]{36}$/.test(owner ?? '')) {
  console.error('Bitte die UUID der Lehrkraft angeben.')
  process.exit(1)
}

const { zeilen, fehler } = kompetenzenAusCsv(readFileSync('docs/kompetenzen.csv', 'utf8'))
if (fehler.length) {
  console.error(fehler.join('\n'))
  process.exit(1)
}

const sql = (wert: string | number | null) =>
  wert === null ? 'null' : typeof wert === 'number' ? String(wert) : `'${wert.replace(/'/g, "''")}'`

const werte = zeilen
  .map((z) => `  (${[owner, z.code, z.kerncurriculum, z.bereich, z.stufe, z.kompetenz, z.hinweis, z.sortierung].map(sql).join(', ')})`)
  .join(',\n')

console.log(`insert into public.kompetenzen (owner, code, kerncurriculum, bereich, stufe, kompetenz, hinweis, sortierung) values
${werte}
on conflict (owner, code) do nothing;
select count(*) as kompetenzen_gesamt from public.kompetenzen where owner = ${sql(owner)};`)

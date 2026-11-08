import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { satzFertig } from '../lib/lueckentext'
import type { Baustein, ReiheOhneLoesung } from '../lib/typen'

// Format „Reihenfolge“: Bausteine (Wortkarten aes-word) in die richtige Reihenfolge bringen.
// * Über jedem Satz steht die Satzart. Werden mehrere Varianten verlangt, gibt es je Variante eine eigene Reihe.
// * Bausteine erscheinen ohne großen Satzanfang und ohne Schlusszeichen – beides erst, wenn die Reihe richtig ist.
// Bedienung am iPad:
//   * Antippen: Baustein oben antippen → er kommt ans Ende der Reihe. In der Reihe antippen → er geht zurück.
//   * Ziehen: Bausteine in die Reihe ziehen und innerhalb der Reihe verschieben, oder zurück nach oben ziehen.
// Nach dem Prüfen: je Platz ✓ (grün) oder ↻ (Pfirsich) – nie rot.

export type VariantenErgebnis = { richtig: boolean; positionen?: boolean[] }

type Props = {
  teil: ReiheOhneLoesung
  nr: number
  /** gelegte Kennungen je Variante */
  gelegt: string[][]
  onAenderung: (neu: string[][]) => void
  ergebnisse: (VariantenErgebnis | undefined)[]
  loesung?: string[]
  gesperrt: boolean
}

export function ReiheAnzeige({ teil, nr, gelegt, onAenderung, ergebnisse, loesung, gesperrt }: Props) {
  const varianten = Math.max(1, teil.varianten ?? 1)
  return (
    <div className="reihe">
      <p className="reihe__nr">
        Satz {nr + 1}
        {teil.satzart && <span className="reihe__satzart"> · {teil.satzart}</span>}
      </p>
      {varianten > 1 && (
        <p className="reihe__auftrag">Bilde {varianten} verschiedene richtige Sätze aus denselben Bausteinen.</p>
      )}
      {Array.from({ length: varianten }, (_, j) => (
        <Variante
          key={j}
          teilId={teil.id}
          bausteine={teil.bausteine}
          zeichen={teil.zeichen ?? ''}
          titel={varianten > 1 ? `Variante ${j + 1}` : null}
          gelegt={gelegt[j] ?? []}
          onAenderung={(neu) => onAenderung(Array.from({ length: varianten }, (_, x) => (x === j ? neu : (gelegt[x] ?? []))))}
          ergebnis={ergebnisse[j]}
          gesperrt={gesperrt}
          beschriftung={`Satz ${nr + 1}${varianten > 1 ? `, Variante ${j + 1}` : ''}`}
        />
      ))}
      {loesung && (
        <p className="reihe__loesung">
          <span className="loesung-anzeige">{loesung.join(' / ')}</span>
        </p>
      )}
    </div>
  )
}

type VarianteProps = {
  teilId: number
  bausteine: Baustein[]
  zeichen: string
  titel: string | null
  gelegt: string[]
  onAenderung: (neu: string[]) => void
  ergebnis: VariantenErgebnis | undefined
  gesperrt: boolean
  beschriftung: string
}

function Variante({ teilId, bausteine, zeichen, titel, gelegt, onAenderung, ergebnis, gesperrt, beschriftung }: VarianteProps) {
  const [gezogen, setGezogen] = useState<string | null>(null)
  const sensoren = useSensors(
    // Erst nach kurzer Bewegung wird gezogen – ein einfaches Antippen bleibt ein Antippen
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const text = (k: string) => bausteine.find((b) => b.k === k)?.v ?? ''
  const vorrat = bausteine.filter((b) => !gelegt.includes(b.k))
  const fertig = gesperrt || ergebnis?.richtig === true
  // Richtig gelegt: jetzt mit großem Satzanfang und Schlusszeichen zeigen
  const anzeige = ergebnis?.richtig ? satzFertig(gelegt.map(text), zeichen) : gelegt.map(text)
  const reiheId = `reihe:${teilId}`
  const vorratId = `vorrat:${teilId}`

  function beimLoslassen({ active, over }: DragEndEvent) {
    setGezogen(null)
    if (!over || fertig) return
    const a = String(active.id)
    const o = String(over.id)
    if (a.startsWith('v:')) {
      // aus dem Vorrat in die Reihe
      const k = a.slice(2)
      if (gelegt.includes(o)) {
        const neu = [...gelegt]
        neu.splice(gelegt.indexOf(o), 0, k)
        onAenderung(neu)
      } else if (o === reiheId) onAenderung([...gelegt, k])
      return
    }
    // innerhalb der Reihe verschieben oder zurück in den Vorrat
    if (o === vorratId || o.startsWith('v:')) onAenderung(gelegt.filter((k) => k !== a))
    else if (gelegt.includes(o) && o !== a) onAenderung(arrayMove(gelegt, gelegt.indexOf(a), gelegt.indexOf(o)))
    else if (o === reiheId) onAenderung([...gelegt.filter((k) => k !== a), a])
  }

  return (
    <div className="reihe__variante">
      {titel && <p className="reihe__variante-titel">{titel}</p>}
      <DndContext
        sensors={sensoren}
        collisionDetection={closestCenter}
        onDragStart={(e) => setGezogen(String(e.active.id))}
        onDragCancel={() => setGezogen(null)}
        onDragEnd={beimLoslassen}
      >
        {!fertig && (
          <Bereich id={vorratId} className="reihe__vorrat" label={`Bausteine für ${beschriftung}`}>
            {vorrat.length === 0 ? (
              <span className="reihe__leer">Alle Bausteine liegen in der Reihe.</span>
            ) : (
              vorrat.map((b) => (
                <VorratsKarte key={b.k} id={`v:${b.k}`} text={b.v} onTippen={() => onAenderung([...gelegt, b.k])} />
              ))
            )}
          </Bereich>
        )}

        <Bereich id={reiheId} className="reihe__ablage" label={`Deine Reihenfolge für ${beschriftung}`}>
          <SortableContext items={gelegt} strategy={rectSortingStrategy}>
            {gelegt.map((k, i) => (
              <ReihenKarte
                key={k}
                id={k}
                text={anzeige[i]}
                platz={i + 1}
                stimmt={ergebnis?.positionen?.[i]}
                gesperrt={fertig}
                onTippen={() => onAenderung(gelegt.filter((x) => x !== k))}
              />
            ))}
          </SortableContext>
          {!fertig && gelegt.length < bausteine.length && (
            <span className="aes-word aes-word--target" aria-hidden="true">
              hier ablegen
            </span>
          )}
        </Bereich>

        <DragOverlay>
          {gezogen ? <span className="aes-word reihe__karte--gezogen">{text(gezogen.replace(/^v:/, ''))}</span> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function Bereich({ id, className, label, children }: { id: string; className: string; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className}${isOver ? ' reihe__bereich--ueber' : ''}`} role="group" aria-label={label}>
      {children}
    </div>
  )
}

function VorratsKarte({ id, text, onTippen }: { id: string; text: string; onTippen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="aes-word"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={onTippen}
      aria-label={`${text} – antippen, um ihn ans Ende der Reihe zu legen`}
    >
      {text}
    </button>
  )
}

type ReihenKarteProps = {
  id: string
  text: string
  platz: number
  stimmt: boolean | undefined
  gesperrt: boolean
  onTippen: () => void
}

function ReihenKarte({ id, text, platz, stimmt, gesperrt, onTippen }: ReihenKarteProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: gesperrt })
  const zustand = stimmt === true ? ' reihe__karte--ok' : stimmt === false ? ' reihe__karte--again' : ''
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`aes-word reihe__karte${zustand}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      disabled={gesperrt}
      {...attributes}
      {...listeners}
      onClick={onTippen}
      aria-label={`Platz ${platz}: ${text}${stimmt === true ? ', richtig' : stimmt === false ? ', schau nochmal hin' : ''} – antippen, um ihn zurückzulegen`}
    >
      {stimmt === true && <span className="markierung" aria-hidden="true">✓</span>}
      {stimmt === false && <span className="markierung" aria-hidden="true">↻</span>}
      {text}
    </button>
  )
}

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
import type { ReiheOhneLoesung } from '../lib/typen'

// Format „Reihenfolge“: Bausteine (Wortkarten aes-word) in die richtige Reihenfolge bringen.
// Bedienung am iPad:
//   * Antippen: Baustein oben antippen → er kommt ans Ende der Reihe. In der Reihe antippen → er geht zurück.
//   * Ziehen: Bausteine in die Reihe ziehen und innerhalb der Reihe verschieben, oder zurück nach oben ziehen.
// Nach dem Prüfen: je Platz ✓ (grün) oder ↻ (Pfirsich) – nie rot.

type Props = {
  teil: ReiheOhneLoesung
  nr: number
  anzahlSaetze: number
  gelegt: string[]
  onAenderung: (neu: string[]) => void
  positionen?: boolean[]
  richtig?: boolean
  loesung?: string[]
  gesperrt: boolean
}

export function ReiheAnzeige({ teil, nr, anzahlSaetze, gelegt, onAenderung, positionen, richtig, loesung, gesperrt }: Props) {
  const [gezogen, setGezogen] = useState<string | null>(null)
  const sensoren = useSensors(
    // Erst nach kurzer Bewegung wird gezogen – ein einfaches Antippen bleibt ein Antippen
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const text = (k: string) => teil.bausteine.find((b) => b.k === k)?.v ?? ''
  const vorrat = teil.bausteine.filter((b) => !gelegt.includes(b.k))
  const fertig = gesperrt || richtig === true
  const reiheId = `reihe:${teil.id}`
  const vorratId = `vorrat:${teil.id}`

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
    <div className="reihe">
      {anzahlSaetze > 1 && <p className="reihe__nr">Satz {nr + 1}</p>}
      <DndContext
        sensors={sensoren}
        collisionDetection={closestCenter}
        onDragStart={(e) => setGezogen(String(e.active.id))}
        onDragCancel={() => setGezogen(null)}
        onDragEnd={beimLoslassen}
      >
        {!fertig && (
          <Bereich id={vorratId} className="reihe__vorrat" label={`Bausteine für Satz ${nr + 1}`}>
            {vorrat.length === 0 ? (
              <span className="reihe__leer">Alle Bausteine liegen in der Reihe.</span>
            ) : (
              vorrat.map((b) => (
                <VorratsKarte key={b.k} id={`v:${b.k}`} text={b.v} onTippen={() => onAenderung([...gelegt, b.k])} />
              ))
            )}
          </Bereich>
        )}

        <Bereich id={reiheId} className="reihe__ablage" label={`Deine Reihenfolge für Satz ${nr + 1}`}>
          <SortableContext items={gelegt} strategy={rectSortingStrategy}>
            {gelegt.map((k, i) => (
              <ReihenKarte
                key={k}
                id={k}
                text={text(k)}
                platz={i + 1}
                stimmt={positionen?.[i]}
                gesperrt={fertig}
                onTippen={() => onAenderung(gelegt.filter((x) => x !== k))}
              />
            ))}
          </SortableContext>
          {!fertig && gelegt.length < teil.bausteine.length && (
            <span className="aes-word aes-word--target" aria-hidden="true">
              hier ablegen
            </span>
          )}
        </Bereich>

        <DragOverlay>
          {gezogen ? <span className="aes-word reihe__karte--gezogen">{text(gezogen.replace(/^v:/, ''))}</span> : null}
        </DragOverlay>
      </DndContext>
      {loesung && (
        <p className="reihe__loesung">
          <span className="loesung-anzeige">{loesung.join(' / ')}</span>
        </p>
      )}
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

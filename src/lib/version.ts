import { useEffect, useState } from 'react'

// Versionsprüfung: Browser (v. a. Safari auf dem iPad) zeigen manchmal noch eine ältere Fassung der App aus dem
// Zwischenspeicher. Wir laden deshalb regelmäßig die Startseite ohne Zwischenspeicher und vergleichen den Namen
// der Programmdatei (er ändert sich bei jeder Veröffentlichung). Nur auf der veröffentlichten Seite aktiv.

const PRUEF_ABSTAND = 5 * 60 * 1000 // alle 5 Minuten und beim Zurückkehren zur Seite
const SCHLUESSEL = 'version-neu-geladen'

function geladeneProgrammdatei(): string | null {
  const skript = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
  return skript ? new URL(skript.src).pathname : null
}

async function aktuelleProgrammdatei(): Promise<string | null> {
  const antwort = await fetch(`${import.meta.env.BASE_URL}?v=${Date.now()}`, { cache: 'no-store' })
  if (!antwort.ok) return null
  const treffer = (await antwort.text()).match(/src="([^"]*\/assets\/[^"]+\.js)"/)
  return treffer ? new URL(treffer[1], window.location.href).pathname : null
}

/** true, wenn eine neuere Version veröffentlicht wurde (dann kann die Seite neu geladen werden). */
export function useNeueVersion(): boolean {
  const [neu, setNeu] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    const geladen = geladeneProgrammdatei()
    if (!geladen) return
    let ersterBlick = true

    async function pruefen() {
      try {
        const aktuell = await aktuelleProgrammdatei()
        if (!aktuell || aktuell === geladen) return
        // Direkt nach dem Öffnen: sofort einmal neu laden (angefangene Antworten sind im Speicher des iPads gesichert).
        // Danach nur noch einen Hinweis zeigen, damit niemand mitten in einer Aufgabe gestört wird.
        if (ersterBlick && sessionStorage.getItem(SCHLUESSEL) !== aktuell) {
          sessionStorage.setItem(SCHLUESSEL, aktuell)
          window.location.reload()
          return
        }
        setNeu(true)
      } catch {
        // Kein Internet – dann eben später.
      } finally {
        ersterBlick = false
      }
    }

    void pruefen()
    const timer = window.setInterval(() => void pruefen(), PRUEF_ABSTAND)
    const beiSichtbar = () => document.visibilityState === 'visible' && void pruefen()
    document.addEventListener('visibilitychange', beiSichtbar)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', beiSichtbar)
    }
  }, [])

  return neu
}

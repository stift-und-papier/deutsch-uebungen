import { useEffect, useState } from 'react'

// Sehr einfache Navigation über den Teil der Adresse nach "#".
// Vorteil: GitHub Pages braucht keine Sonderkonfiguration, und der Schüler-Token
// hinter "#" wird beim Laden der Seite nicht an den Server geschickt.

function lesePfad(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function usePfad(): string[] {
  const [pfad, setPfad] = useState(lesePfad)
  useEffect(() => {
    const beiAenderung = () => {
      setPfad(lesePfad())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', beiAenderung)
    return () => window.removeEventListener('hashchange', beiAenderung)
  }, [])
  return pfad
}

export function gehe(pfad: string) {
  window.location.hash = pfad
}

/** Vollständiger persönlicher Link für eine Schülerin/einen Schüler. */
export function schuelerLink(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/s/${token}`
}

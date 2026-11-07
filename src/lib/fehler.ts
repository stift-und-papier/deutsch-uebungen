// Macht aus technischen Fehlermeldungen verständliche Sätze.

export function fehlerText(fehler: unknown): string {
  const nachricht =
    typeof fehler === 'object' && fehler && 'message' in fehler ? String((fehler as { message: unknown }).message) : String(fehler)
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(nachricht)) {
    return 'Keine Verbindung zum Internet. Bitte versuch es gleich noch einmal.'
  }
  if (/duplicate key.*klasse_id, pseudonym|schueler_klasse_id_pseudonym_key/i.test(nachricht)) {
    return 'Dieses Pseudonym gibt es in der Klasse schon.'
  }
  if (/Invalid login credentials/i.test(nachricht)) {
    return 'E-Mail-Adresse oder Passwort stimmen nicht.'
  }
  return nachricht
}

/** true, wenn der Fehler nur an fehlendem Internet liegt (dann später erneut senden). */
export function istNetzwerkfehler(fehler: unknown): boolean {
  const nachricht =
    typeof fehler === 'object' && fehler && 'message' in fehler ? String((fehler as { message: unknown }).message) : String(fehler)
  return /Failed to fetch|NetworkError|Load failed|network|timeout/i.test(nachricht)
}

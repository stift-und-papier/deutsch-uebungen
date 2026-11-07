-- Rückmeldetext "Was schon gelingt": {aufgaben} wird zu "Aufgabe" oder "Aufgaben" (Einzahl/Mehrzahl).
alter table public.einstellungen alter column texte set default '{
  "deutlich": "Hier bist du deutlich besser geworden!",
  "besser": "Hier wirst du besser.",
  "dranbleiben": "Hier bleibst du dran – Üben lohnt sich hier besonders.",
  "erste": "Hier sammeln wir noch deine ersten Ergebnisse.",
  "gelungen": "Schon {anzahl} {aufgaben} richtig gelöst.",
  "naechster_schritt": "Übe als Nächstes:"
}'::jsonb;

update public.einstellungen
set texte = jsonb_set(texte, '{gelungen}', '"Schon {anzahl} {aufgaben} richtig gelöst."')
where texte ->> 'gelungen' = 'Schon {anzahl} Aufgaben richtig gelöst.';

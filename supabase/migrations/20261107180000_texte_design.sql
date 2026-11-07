-- Standardtexte der Entwicklungskacheln an das Design-System „Übungswiese“ angleichen.
-- Texte, die die Lehrkraft bereits selbst geändert hat, bleiben unverändert.
alter table public.einstellungen alter column texte set default '{
  "deutlich": "Hier bist du deutlich besser geworden",
  "besser": "Hier wirst du besser",
  "dranbleiben": "Hier lohnt sich noch Übung",
  "erste": "Wir sammeln noch deine ersten Ergebnisse",
  "gelungen": "Schon {anzahl} {aufgaben} richtig gelöst.",
  "naechster_schritt": "Übe als Nächstes:"
}'::jsonb;

update public.einstellungen set texte = jsonb_set(texte, '{deutlich}', '"Hier bist du deutlich besser geworden"')
where texte ->> 'deutlich' = 'Hier bist du deutlich besser geworden!';
update public.einstellungen set texte = jsonb_set(texte, '{besser}', '"Hier wirst du besser"')
where texte ->> 'besser' = 'Hier wirst du besser.';
update public.einstellungen set texte = jsonb_set(texte, '{dranbleiben}', '"Hier lohnt sich noch Übung"')
where texte ->> 'dranbleiben' = 'Hier bleibst du dran – Üben lohnt sich hier besonders.';
update public.einstellungen set texte = jsonb_set(texte, '{erste}', '"Wir sammeln noch deine ersten Ergebnisse"')
where texte ->> 'erste' = 'Hier sammeln wir noch deine ersten Ergebnisse.';

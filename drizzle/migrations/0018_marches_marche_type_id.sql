-- V1.9 PR #2 — M1 : type de travaux affectable globalement sur un marché
-- En complément du `marche_type_id` déjà présent sur `marche_sous_lots` (V1.8 P2-1),
-- on ajoute un champ optionnel au niveau du marché lui-même pour qu'on puisse
-- qualifier le marché global ("Plomberie", "Peinture", etc.) sans devoir
-- forcément créer un sous-lot technique.
--
-- ON DELETE SET NULL : si un type est supprimé/désactivé, le FK marche conserve
-- son existence (le marché ne disparaît pas).

ALTER TABLE marches_travaux
  ADD COLUMN marche_type_id uuid REFERENCES marche_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marches_travaux_marche_type_id_idx
  ON marches_travaux (marche_type_id);

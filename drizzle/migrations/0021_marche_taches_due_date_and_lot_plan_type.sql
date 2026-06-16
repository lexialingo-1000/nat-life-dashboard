-- V12bis PR4 — Suivi travaux
-- J4 : ajoute due_date sur marche_taches (échéance)
-- D1 : seed type de doc 'plan' scope=lot pour l'onglet Plans sur fiche Lot

ALTER TABLE marche_taches
  ADD COLUMN due_date date;

COMMENT ON COLUMN marche_taches.due_date IS
  'Échéance prévue (V12bis PR4). Remplace progressivement le champ description sur les forms tâche.';

-- Seed type de doc 'plan' scope=lot (D1) — idempotent
INSERT INTO document_types (code, label, scope, sort_order, is_active, has_expiration)
VALUES ('plan', 'Plan', 'lot', 50, true, false)
ON CONFLICT (code, scope) DO NOTHING;

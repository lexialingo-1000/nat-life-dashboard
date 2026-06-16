-- V1.11 R1 — champ ETAT (ACTIF/INACTIF) sur marchés de travaux.
-- Default ACTIF à la création. Filtre par défaut sur la liste = ACTIF seulement.
-- Source : Remarques client dashboard-15.pages §1.

ALTER TABLE marches_travaux
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Index partiel pour accélérer le scan par défaut (la liste filtre WHERE is_active = true).
CREATE INDEX IF NOT EXISTS idx_marches_travaux_is_active_true
  ON marches_travaux (is_active)
  WHERE is_active = true;

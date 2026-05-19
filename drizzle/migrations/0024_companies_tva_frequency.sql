-- V1.11 R8 — fréquence TVA pour les sociétés.
-- Checkbox UI "Assujettie à la TVA" pilote l'affichage du select.
-- Stockage DB en enum unique nullable :
--   NULL = info pas encore renseignée (sociétés existantes)
--   'non_assujettie' = explicitement non assujettie (checkbox décochée)
--   'mensuelle' / 'trimestrielle' / 'annuelle' = checkbox cochée + fréquence
-- Source : Remarques client dashboard-15.pages §3 (FICHE SOCIETE).

CREATE TYPE tva_frequency AS ENUM (
  'non_assujettie',
  'mensuelle',
  'trimestrielle',
  'annuelle'
);

ALTER TABLE companies
  ADD COLUMN tva_frequency tva_frequency;

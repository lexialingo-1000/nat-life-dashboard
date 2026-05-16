-- V12bis PR5 — A1 : numéro TVA intracom sur fiche Société

ALTER TABLE companies
  ADD COLUMN tva_intracom varchar(20);

COMMENT ON COLUMN companies.tva_intracom IS
  'Numéro TVA intracommunautaire (V12bis PR5). Format FR + 11 chiffres pour entités FR, nullable pour entités sans TVA.';

-- V1.14 CL-1 — Onglet Compta sur fiche client : liste des factures de location.
-- Source : Remarques client dashboard-18 §FICHE CLIENTS.
--
-- Ajoute 2 document_types scope=location pour permettre l'upload de factures /
-- quittances de loyer sur les locations. Ces types sont catégorisés
-- 'comptabilite' (category_id correspondant), ce qui permet à l'onglet Compta
-- du client de filtrer les location_documents par category sans hardcoder les
-- codes.
--
-- Idempotent : ON CONFLICT (code, scope) DO NOTHING ne s'applique pas (pas de
-- contrainte unique composite côté DB), donc on guard avec NOT EXISTS.

INSERT INTO document_types (code, label, scope, sort_order, has_expiration, category)
SELECT 'facture_loyer', 'Facture loyer', 'location', 50, false, 'comptabilite'
WHERE NOT EXISTS (
  SELECT 1 FROM document_types WHERE code = 'facture_loyer' AND scope = 'location'
);

INSERT INTO document_types (code, label, scope, sort_order, has_expiration, category)
SELECT 'quittance_loyer', 'Quittance loyer', 'location', 60, false, 'comptabilite'
WHERE NOT EXISTS (
  SELECT 1 FROM document_types WHERE code = 'quittance_loyer' AND scope = 'location'
);

-- Lier category_id (FK V1.12) si la catégorie 'comptabilite' existe
-- (créée par 0020_supplier_types_and_doc_categories).
UPDATE document_types
SET category_id = (SELECT id FROM document_categories WHERE code = 'comptabilite' LIMIT 1)
WHERE code IN ('facture_loyer', 'quittance_loyer')
  AND scope = 'location'
  AND category_id IS NULL;

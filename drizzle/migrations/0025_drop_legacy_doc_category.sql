-- V1.12 R1+R2 — drop col legacy `category` sur les 7 tables documents.
-- Source unique de vérité = document_types.category (+ document_types.category_id FK).
-- Décision client : la catégorie est paramétrée UNE SEULE FOIS sur le type de document
-- côté admin, plus possibilité d'override par document (Remarques client dashboard-16 §1+§2).
-- document_types.category lui-même est PRÉSERVÉ.

ALTER TABLE company_documents DROP COLUMN IF EXISTS category;
ALTER TABLE supplier_documents DROP COLUMN IF EXISTS category;
ALTER TABLE customer_documents DROP COLUMN IF EXISTS category;
ALTER TABLE property_documents DROP COLUMN IF EXISTS category;
ALTER TABLE lot_documents DROP COLUMN IF EXISTS category;
ALTER TABLE marche_documents DROP COLUMN IF EXISTS category;
ALTER TABLE location_documents DROP COLUMN IF EXISTS category;

-- Vague 3 retours Natacha : ajout du scope `company` à document_scope.
-- ⚠ ALTER TYPE ADD VALUE doit s'exécuter HORS transaction. Drizzle wraps les
-- migrations par défaut, donc on l'isole dans son propre fichier — la 2ᵉ
-- migration (0005_company_documents_table.sql) crée la table + le seed.

ALTER TYPE "document_scope" ADD VALUE IF NOT EXISTS 'company' BEFORE 'supplier';

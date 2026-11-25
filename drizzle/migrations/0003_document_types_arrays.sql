-- Retours 24/11/2026 pt 12 — Types de documents : sélection MULTIPLE des types de
-- locataire / fournisseur / société. Étape 1/2 : ajout des colonnes tableau + copie des
-- valeurs existantes. Les anciennes colonnes sont supprimées en 0004 (migration séparée
-- pour que drizzle-kit n'interprète pas DROP+ADD comme un renommage avec perte de données).
-- Sémantique : NULL ou tableau vide = s'applique à tous. Locataires : 'all' (et NULL) → NULL.
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "supplier_type_ids" uuid[];--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "applies_to_tenant_types" text[];--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "applies_to_company_types" text[];--> statement-breakpoint
UPDATE "document_types" SET "supplier_type_ids" = ARRAY["supplier_type_id"] WHERE "supplier_type_id" IS NOT NULL;--> statement-breakpoint
UPDATE "document_types" SET "applies_to_tenant_types" = ARRAY["applies_to_tenant_type"] WHERE "applies_to_tenant_type" IN ('LT', 'CT');--> statement-breakpoint
UPDATE "document_types" SET "applies_to_company_types" = ARRAY["applies_to_company_type"] WHERE "applies_to_company_type" IS NOT NULL;

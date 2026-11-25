-- Retours 24/11/2026 pt 12 — étape 2/2 : suppression des anciennes colonnes scalaires,
-- dont les valeurs ont été copiées dans les colonnes tableau par 0003.
ALTER TABLE "document_types" DROP COLUMN IF EXISTS "supplier_type_id";--> statement-breakpoint
ALTER TABLE "document_types" DROP COLUMN IF EXISTS "applies_to_tenant_type";--> statement-breakpoint
ALTER TABLE "document_types" DROP COLUMN IF EXISTS "applies_to_company_type";
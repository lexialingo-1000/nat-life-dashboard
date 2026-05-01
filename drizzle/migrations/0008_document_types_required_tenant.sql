ALTER TABLE "document_types" ADD COLUMN "is_required" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

ALTER TABLE "document_types" ADD COLUMN "applies_to_tenant_type" text;
--> statement-breakpoint

ALTER TABLE "document_types" ADD CONSTRAINT "document_types_applies_to_tenant_type_check"
  CHECK ("applies_to_tenant_type" IS NULL OR "applies_to_tenant_type" IN ('LT', 'CT', 'all'));
--> statement-breakpoint

COMMENT ON COLUMN "document_types"."is_required" IS
  'Si true, ce document est requis pour toute entité du scope. Alimente le widget "Documents requis manquants".';
--> statement-breakpoint

COMMENT ON COLUMN "document_types"."applies_to_tenant_type" IS
  'Pour scope=customer uniquement : LT/CT/all/NULL. Permet de différencier les docs requis par type de locataire.';

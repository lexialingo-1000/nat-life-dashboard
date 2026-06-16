-- Migration 0015 — V1.9
-- Split property_statut : 'loue_ou_vacant' devient 'loue' + 'vacant' (statuts distincts).
-- Source : Remarques clients dashboard 10 §"Statut du bien" — Natacha demande 4 statuts.
-- Mapping de migration : tous les 'loue_ou_vacant' existants → 'vacant' (safe default,
-- Natacha pourra reclassifier les biens loués manuellement après le passage en prod).
-- ⚠ Appliquer via Supabase MCP avant le deploy Coolify correspondant.

ALTER TYPE "public"."property_statut" RENAME TO "property_statut_old";
--> statement-breakpoint

CREATE TYPE "public"."property_statut" AS ENUM (
  'en_cours_acquisition',
  'loue',
  'vacant',
  'vendu'
);
--> statement-breakpoint

ALTER TABLE "properties"
  ALTER COLUMN "statut" DROP DEFAULT;
--> statement-breakpoint

ALTER TABLE "properties"
  ALTER COLUMN "statut" TYPE "public"."property_statut"
  USING (
    CASE "statut"::text
      WHEN 'loue_ou_vacant' THEN 'vacant'::"public"."property_statut"
      WHEN 'en_cours_acquisition' THEN 'en_cours_acquisition'::"public"."property_statut"
      WHEN 'vendu' THEN 'vendu'::"public"."property_statut"
    END
  );
--> statement-breakpoint

ALTER TABLE "properties"
  ALTER COLUMN "statut" SET DEFAULT 'vacant';
--> statement-breakpoint

DROP TYPE "public"."property_statut_old";

-- dashboard-22: supprimer statut "Devis reçu" (marcheStatusEnum)
-- Migrer les données existantes avant d'altérer l'enum
UPDATE "marches_travaux" SET status = 'signe' WHERE status = 'devis_recu';
UPDATE "marche_sous_lots" SET status = 'signe' WHERE status = 'devis_recu';

-- Recréer l'enum sans 'devis_recu' (PostgreSQL ne supporte pas DROP VALUE directement)
ALTER TYPE "public"."marche_status" RENAME TO "marche_status_old";
--> statement-breakpoint
CREATE TYPE "public"."marche_status" AS ENUM ('signe', 'en_cours', 'livre', 'conteste', 'annule');
--> statement-breakpoint

-- marches_travaux.status
ALTER TABLE "marches_travaux" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "marches_travaux" ALTER COLUMN "status" TYPE "public"."marche_status" USING "status"::text::"public"."marche_status";
--> statement-breakpoint
ALTER TABLE "marches_travaux" ALTER COLUMN "status" SET DEFAULT 'signe';
--> statement-breakpoint

-- marche_sous_lots.status
ALTER TABLE "marche_sous_lots" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "marche_sous_lots" ALTER COLUMN "status" TYPE "public"."marche_status" USING "status"::text::"public"."marche_status";
--> statement-breakpoint
ALTER TABLE "marche_sous_lots" ALTER COLUMN "status" SET DEFAULT 'signe';
--> statement-breakpoint

DROP TYPE "public"."marche_status_old";

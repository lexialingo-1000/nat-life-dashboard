-- dashboard-22: type de société × 4 valeurs (commerciale/immobilière × bilan/sans bilan)
ALTER TABLE "public"."companies" ALTER COLUMN "type" SET DATA TYPE text;
--> statement-breakpoint
-- Migrer données existantes avant de recréer l'enum
UPDATE "public"."companies" SET "type" = 'commerciale_bilan' WHERE "type" = 'commerciale';
--> statement-breakpoint
UPDATE "public"."companies" SET "type" = 'immobiliere_bilan' WHERE "type" = 'immobiliere';
--> statement-breakpoint
DROP TYPE "public"."company_type";
--> statement-breakpoint
CREATE TYPE "public"."company_type" AS ENUM('commerciale_bilan', 'commerciale_sans_bilan', 'immobiliere_bilan', 'immobiliere_sans_bilan');
--> statement-breakpoint
ALTER TABLE "public"."companies" ALTER COLUMN "type" SET DATA TYPE "public"."company_type" USING "type"::"public"."company_type";

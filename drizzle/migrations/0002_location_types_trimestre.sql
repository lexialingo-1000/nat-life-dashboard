-- Retours 24/11/2026 lot C pt 6 — périodicité « Trimestre » + types de location paramétrables.
-- ADD VALUE : drizzle (pg migrator) exécute TOUTES les migrations en attente dans UNE transaction.
-- Postgres >= 12 (Supabase : 15+) accepte ADD VALUE en transaction, mais la nouvelle valeur n'est
-- utilisable qu'après COMMIT : aucune instruction de ce lot (ni d'une migration suivante appliquée
-- dans le même déploiement) ne doit utiliser 'trimestre'. Ici rien ne l'utilise.
ALTER TYPE "public"."location_periodicite" ADD VALUE 'trimestre' BEFORE 'annee';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "type_location" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "type_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_type_id_location_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."location_types"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- Données : catalogue initial = les 4 valeurs de l'enum location_type + « Bail commercial ».
INSERT INTO "location_types" ("code", "label", "sort_order") VALUES
 ('bail_meuble_annuel', 'Bail meublé annuel', 10),
 ('bail_nu_annuel', 'Bail nu annuel', 20),
 ('saisonnier_direct', 'Saisonnier direct', 30),
 ('saisonnier_plateforme', 'Saisonnier plateforme', 40),
 ('bail_commercial', 'Bail commercial', 50)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- Données : chaque location existante garde son type (enum -> FK). Colonne type_location gardée.
UPDATE "locations" AS l
SET "type_id" = lt."id"
FROM "location_types" AS lt
WHERE l."type_id" IS NULL AND lt."code" = l."type_location"::text;

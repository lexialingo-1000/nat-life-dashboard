CREATE TABLE IF NOT EXISTS "contract_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lot_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"contract_number" text,
	"customer_number" text,
	"comment" text,
	"storage_key" text,
	"file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lot_contracts" ADD CONSTRAINT "lot_contracts_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lot_contracts" ADD CONSTRAINT "lot_contracts_type_id_contract_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."contract_types"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Données : catalogue initial des types de contrat (Paramètres → Types de contrat).
INSERT INTO "contract_types" ("code", "label", "sort_order") VALUES
 ('eau', 'Eau', 10),
 ('electricite', 'Électricité', 20),
 ('internet', 'Internet', 30),
 ('assurance', 'Assurance', 40)
ON CONFLICT ("code") DO NOTHING;

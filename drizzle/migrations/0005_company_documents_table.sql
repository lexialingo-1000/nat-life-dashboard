-- Table company_documents (PJ par société) + seed des document_types scope `company`.
-- Suppose que la migration 0004 a bien ajouté la valeur 'company' à l'enum.

CREATE TABLE IF NOT EXISTS "company_documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL,
    "type_id" uuid NOT NULL,
    "name" text NOT NULL,
    "storage_key" text NOT NULL,
    "document_date" date,
    "expires_at" date,
    "notes" text,
    "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
    "uploaded_by" uuid
);
--> statement-breakpoint

ALTER TABLE "company_documents"
    ADD CONSTRAINT "company_documents_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id")
    ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "company_documents"
    ADD CONSTRAINT "company_documents_type_id_document_types_id_fk"
    FOREIGN KEY ("type_id") REFERENCES "public"."document_types"("id")
    ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "company_documents"
    ADD CONSTRAINT "company_documents_uploaded_by_users_id_fk"
    FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- RLS deny by default (cohérent avec les 20 autres tables ; le backend Drizzle
-- bypass via DATABASE_URL/postgres user).
ALTER TABLE "company_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

INSERT INTO "document_types" ("code", "label", "scope", "sort_order", "has_expiration") VALUES
    ('kbis', 'KBis', 'company', 10, false),
    ('statuts', 'Statuts', 'company', 20, false),
    ('rib', 'RIB', 'company', 30, false),
    ('attestation_fiscale', 'Attestation fiscale', 'company', 40, true),
    ('autre', 'Autre', 'company', 99, false)
ON CONFLICT (code, scope) DO NOTHING;

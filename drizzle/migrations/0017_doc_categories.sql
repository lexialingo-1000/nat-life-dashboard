-- Migration 0017 — V1.9 Lot E
-- Catégories sur types de documents (défaut) ET sur tables documents (override).
-- Source : Remarques clients dashboard 10 §"Fournisseurs : nouveaux types" — Natacha
-- veut "classer les documents de la liste des types de documents en catégories
-- (juridiques, compta etc)". Décision (10/05) : enum + colonne sur types ET docs
-- (override possible à l'upload).
-- 6 catégories : notaire, banque, juridique, comptabilite, courant, location.
-- ⚠ Appliquer via Supabase MCP avant le deploy Coolify correspondant.

CREATE TYPE "public"."document_category" AS ENUM (
  'notaire',
  'banque',
  'juridique',
  'comptabilite',
  'courant',
  'location'
);
--> statement-breakpoint

ALTER TABLE "document_types"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

ALTER TABLE "supplier_documents"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

ALTER TABLE "customer_documents"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

ALTER TABLE "company_documents"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

ALTER TABLE "property_documents"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

ALTER TABLE "lot_documents"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

ALTER TABLE "marche_documents"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

ALTER TABLE "location_documents"
  ADD COLUMN "category" "public"."document_category";
--> statement-breakpoint

-- Backfill : types existants → catégorie par défaut.
-- Ces 6 codes ont été ajoutés en V1.7 P3 (migration 0009) côté supplier
-- comme labels "Notaire", "Banque", etc. — on les associe à leur catégorie homonyme.
UPDATE "document_types" SET "category" = 'notaire'      WHERE "code" = 'notaire'      AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'banque'       WHERE "code" = 'banque'       AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'juridique'    WHERE "code" = 'juridique'    AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'comptabilite' WHERE "code" = 'comptabilite' AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'courant'      WHERE "code" = 'courant'      AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'location'     WHERE "code" = 'contrat_location' AND "category" IS NULL;
--> statement-breakpoint

-- Mappings sémantiques : autres types → catégorie cohérente.
UPDATE "document_types" SET "category" = 'juridique'    WHERE "code" IN ('kbis', 'responsabilite_civile', 'garantie_decennale', 'attestation_vigilance') AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'banque'       WHERE "code" = 'rib'           AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'notaire'      WHERE "code" IN ('compromis_achat', 'acte_achat', 'compromis_vente', 'acte_vente', 'reglement_copro') AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'juridique'    WHERE "code" IN ('contrat_cadre', 'pv_ag', 'piece_identite') AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'comptabilite' WHERE "code" IN ('devis', 'facture_acompte', 'facture_solde') AND "category" IS NULL;
UPDATE "document_types" SET "category" = 'location'     WHERE "code" IN ('bail', 'bail_signe', 'etat_lieux_entree', 'etat_lieux_sortie') AND "category" IS NULL;

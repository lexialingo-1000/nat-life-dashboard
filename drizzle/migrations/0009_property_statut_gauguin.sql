-- Migration 0009 — V1.7
-- 1. Nouveau type enum property_statut
-- 2. Colonne statut sur properties
-- 3. Seed bien Gauguin pour KAPIMMO
-- ⚠ Appliquer via Supabase MCP avant le deploy Coolify correspondant.

CREATE TYPE "public"."property_statut" AS ENUM('en_cours_acquisition', 'loue_ou_vacant', 'vendu');
--> statement-breakpoint

ALTER TABLE "properties"
  ADD COLUMN "statut" "property_statut" NOT NULL DEFAULT 'loue_ou_vacant';
--> statement-breakpoint

-- Seed : Appartement le Gauguin (KAPIMMO)
INSERT INTO "properties" ("id", "company_id", "name", "type", "statut", "address", "city", "postal_code")
SELECT
  gen_random_uuid(),
  c.id,
  'Appartement le Gauguin',
  'appartement',
  'loue_ou_vacant',
  '18 Chemin Brunet',
  'Aix-en-Provence',
  '13090'
FROM "companies" c
WHERE c.siren = '102418530'  -- KAPIMMO
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Seed : nouveaux types de documents fournisseur (F12)
INSERT INTO "document_types" ("code", "label", "scope", "sort_order", "has_expiration", "is_active")
VALUES
  ('notaire',       'Notaire',        'supplier', 55, false, true),
  ('banque',        'Banque',         'supplier', 56, false, true),
  ('juridique',     'Juridique',      'supplier', 57, false, true),
  ('comptabilite',  'Comptabilité',   'supplier', 58, false, true),
  ('courant',       'Courant',        'supplier', 59, false, true),
  ('location',      'Location',       'supplier', 60, false, true)
ON CONFLICT (code, scope) DO NOTHING;

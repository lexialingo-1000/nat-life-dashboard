-- V12bis PR2 — Paramètres admin paramétrables
-- F2 : table supplier_types remplace enum hardcodé (10 valeurs)
-- F3 : table document_categories remplace enum hardcodé (6 valeurs)
-- K1 : FK supplier_type_id sur document_types (typage par catégorie de fournisseur)
--
-- Stratégie compat : on CRÉE les nouvelles tables + colonnes FK
-- mais on GARDE les enums existants (suppliers.type, documents.category)
-- pour ne pas casser les lectures actuelles. Drop des enums = PR future.

-- ============================================================================
-- F2 — supplier_types
-- ============================================================================
CREATE TABLE supplier_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE supplier_types ENABLE ROW LEVEL SECURITY;

-- Seed depuis enum existant
INSERT INTO supplier_types (code, label, sort_order) VALUES
  ('notaire',       'Notaire',       10),
  ('banque',        'Banque',        20),
  ('juridique',     'Juridique',     30),
  ('comptabilite',  'Comptabilité',  40),
  ('architecte',    'Architecte',    50),
  ('entrepreneur',  'Entrepreneur',  60),
  ('syndic',        'Syndic',        70),
  ('diagnostic',    'Diagnostic',    80),
  ('assurance',     'Assurance',     90),
  ('autre',         'Autre',         100)
ON CONFLICT (code) DO NOTHING;

-- FK sur suppliers (nullable, ON DELETE SET NULL pour ne pas perdre le fournisseur)
ALTER TABLE suppliers
  ADD COLUMN type_id uuid REFERENCES supplier_types(id) ON DELETE SET NULL;

-- Backfill : map enum value → table id par code
UPDATE suppliers s
SET type_id = st.id
FROM supplier_types st
WHERE st.code = s.type::text;

CREATE INDEX suppliers_type_id_idx ON suppliers (type_id) WHERE type_id IS NOT NULL;

-- ============================================================================
-- F3 — document_categories
-- ============================================================================
CREATE TABLE document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

-- Seed depuis enum existant
INSERT INTO document_categories (code, label, sort_order) VALUES
  ('notaire',       'Notaire',       10),
  ('banque',        'Banque',        20),
  ('juridique',     'Juridique',     30),
  ('comptabilite',  'Comptabilité',  40),
  ('courant',       'Courant',       50),
  ('location',      'Location',      60)
ON CONFLICT (code) DO NOTHING;

-- FK sur document_types (catégorie par défaut, héritée par les docs uploadés)
ALTER TABLE document_types
  ADD COLUMN category_id uuid REFERENCES document_categories(id) ON DELETE SET NULL;

UPDATE document_types dt
SET category_id = dc.id
FROM document_categories dc
WHERE dc.code = dt.category::text;

CREATE INDEX document_types_category_id_idx ON document_types (category_id) WHERE category_id IS NOT NULL;

-- ============================================================================
-- K1 — supplier_type_id sur document_types (scope=fournisseur uniquement)
-- ============================================================================
ALTER TABLE document_types
  ADD COLUMN supplier_type_id uuid REFERENCES supplier_types(id) ON DELETE SET NULL;

CREATE INDEX document_types_supplier_type_id_idx
  ON document_types (supplier_type_id)
  WHERE supplier_type_id IS NOT NULL;

COMMENT ON COLUMN document_types.supplier_type_id IS
  'Si scope=supplier et supplier_type_id non NULL : ce type de doc s''applique uniquement aux fournisseurs de ce type. Sinon, applicable à tous.';

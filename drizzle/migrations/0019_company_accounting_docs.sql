-- V1.9 PR #4 — C1 : onglet Compta minimal sur fiche société (V11 §44+)
-- Stockage doc devis/commande/facture par société, lié obligatoirement
-- à un fournisseur et optionnellement à un marché de travaux.
--
-- Décision client (validée avant build) : on stocke d'abord les fichiers,
-- sans logique métier (pas d'association commande↔facture obligatoire,
-- pas de sync Pennylane). Le reste reste V1.5 post-réforme PA (1er sept 2026).

CREATE TYPE accounting_doc_kind AS ENUM ('devis', 'commande', 'facture');

CREATE TABLE company_accounting_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  marche_id uuid REFERENCES marches_travaux(id) ON DELETE SET NULL,
  kind accounting_doc_kind NOT NULL,
  name text NOT NULL,
  storage_key text NOT NULL,
  document_date date,
  amount_ht numeric(14,2),
  amount_ttc numeric(14,2),
  notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX company_accounting_documents_company_kind_date_idx
  ON company_accounting_documents (company_id, kind, document_date DESC NULLS LAST);

CREATE INDEX company_accounting_documents_supplier_idx
  ON company_accounting_documents (supplier_id);

CREATE INDEX company_accounting_documents_marche_idx
  ON company_accounting_documents (marche_id)
  WHERE marche_id IS NOT NULL;

ALTER TABLE company_accounting_documents ENABLE ROW LEVEL SECURITY;

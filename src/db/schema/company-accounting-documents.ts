import { pgTable, uuid, text, timestamp, date, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { suppliers } from './suppliers';
import { marchesTravaux } from './marches';
import { users } from './users';

/**
 * Documents comptables stockés sur fiche société (V1.9 PR #4 — C1).
 *
 * Périmètre V1.9 : stockage de fichiers uniquement (devis/commande/facture)
 * liés obligatoirement à un fournisseur, optionnellement à un marché. Pas
 * de logique métier (pas d'association commande↔facture obligatoire, pas
 * de sync Pennylane). Le module compta complet reste V1.5 post-réforme PA
 * (1er sept 2026) — voir `expenses` / `pending_orders` / `pennylane_invoice_lines`
 * dans l'annexe différée du CLAUDE.md projet.
 */

export const accountingDocKindEnum = pgEnum('accounting_doc_kind', [
  'devis',
  'commande',
  'facture',
]);

export const companyAccountingDocuments = pgTable('company_accounting_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'restrict' }),
  marcheId: uuid('marche_id').references(() => marchesTravaux.id, { onDelete: 'set null' }),
  kind: accountingDocKindEnum('kind').notNull(),
  name: text('name').notNull(),
  storageKey: text('storage_key').notNull(),
  documentDate: date('document_date'),
  amountHt: numeric('amount_ht', { precision: 14, scale: 2 }),
  amountTtc: numeric('amount_ttc', { precision: 14, scale: 2 }),
  notes: text('notes'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
});

export type CompanyAccountingDocument = typeof companyAccountingDocuments.$inferSelect;
export type NewCompanyAccountingDocument = typeof companyAccountingDocuments.$inferInsert;

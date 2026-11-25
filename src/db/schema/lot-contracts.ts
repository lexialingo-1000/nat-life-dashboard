import { pgTable, uuid, text, timestamp, date } from 'drizzle-orm/pg-core';
import { lots } from './properties';
import { contractTypes } from './contract-types';

// Retours 24/11/2026 pt 7 — contrats d'un lot (onglet « Contrats » de la fiche lot).
// Pièce jointe facultative : clé MinIO `Lots/contrats/<lotId>/<horodatage>-<fichier>`
// (contrôlée par isLotContractKey) + nom d'origine du fichier.
export const lotContracts = pgTable('lot_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'cascade' }),
  typeId: uuid('type_id')
    .notNull()
    .references(() => contractTypes.id, { onDelete: 'restrict' }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  contractNumber: text('contract_number'),
  customerNumber: text('customer_number'),
  comment: text('comment'),
  storageKey: text('storage_key'),
  fileName: text('file_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LotContract = typeof lotContracts.$inferSelect;
export type NewLotContract = typeof lotContracts.$inferInsert;

import { pgTable, uuid, text, timestamp, date, integer, numeric } from 'drizzle-orm/pg-core';
import { marcheStatusEnum } from './enums';
import { lots } from './properties';
import { suppliers } from './suppliers';
import { documentTypes } from './document-types';
import { users } from './users';

export const marchesTravaux = pgTable('marches_travaux', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'restrict' }),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description'),
  amountHt: numeric('amount_ht', { precision: 14, scale: 2 }),
  amountTtc: numeric('amount_ttc', { precision: 14, scale: 2 }),
  dateDevis: date('date_devis'),
  dateSignature: date('date_signature'),
  dateDebutPrevu: date('date_debut_prevu'),
  dateFinPrevu: date('date_fin_prevu'),
  dateDebutReel: date('date_debut_reel'),
  dateFinReelle: date('date_fin_reelle'),
  status: marcheStatusEnum('status').notNull().default('devis_recu'),
  storagePath: text('storage_path'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const marcheLots = pgTable('marche_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  marcheId: uuid('marche_id')
    .notNull()
    .references(() => marchesTravaux.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  amountHt: numeric('amount_ht', { precision: 14, scale: 2 }),
  amountTtc: numeric('amount_ttc', { precision: 14, scale: 2 }),
  supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  dateDebutPrevu: date('date_debut_prevu'),
  dateFinPrevu: date('date_fin_prevu'),
  dateDebutReel: date('date_debut_reel'),
  dateFinReelle: date('date_fin_reelle'),
  status: marcheStatusEnum('status').notNull().default('devis_recu'),
  sortOrder: integer('sort_order').notNull().default(0),
  storagePath: text('storage_path'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const marcheDocuments = pgTable('marche_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  marcheId: uuid('marche_id')
    .notNull()
    .references(() => marchesTravaux.id, { onDelete: 'cascade' }),
  typeId: uuid('type_id')
    .notNull()
    .references(() => documentTypes.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  storageKey: text('storage_key').notNull(),
  documentDate: date('document_date'),
  expiresAt: date('expires_at'),
  notes: text('notes'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
});

export type MarcheTravaux = typeof marchesTravaux.$inferSelect;
export type NewMarcheTravaux = typeof marchesTravaux.$inferInsert;
export type MarcheLot = typeof marcheLots.$inferSelect;
export type NewMarcheLot = typeof marcheLots.$inferInsert;
export type MarcheDocument = typeof marcheDocuments.$inferSelect;
export type NewMarcheDocument = typeof marcheDocuments.$inferInsert;

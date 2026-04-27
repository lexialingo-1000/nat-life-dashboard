import { pgTable, uuid, text, timestamp, date, numeric } from 'drizzle-orm/pg-core';
import { locationTypeEnum, locationPeriodiciteEnum } from './enums';
import { lots } from './properties';
import { customers } from './customers';
import { documentTypes } from './document-types';
import { users } from './users';

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'restrict' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  typeLocation: locationTypeEnum('type_location').notNull(),
  dateDebut: date('date_debut').notNull(),
  dateFin: date('date_fin'),
  prixLocation: numeric('prix_location', { precision: 14, scale: 2 }),
  depotGarantie: numeric('depot_garantie', { precision: 14, scale: 2 }),
  prix: numeric('prix', { precision: 14, scale: 2 }),
  periodicite: locationPeriodiciteEnum('periodicite').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const locationDocuments = pgTable('location_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
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

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type LocationDocument = typeof locationDocuments.$inferSelect;
export type NewLocationDocument = typeof locationDocuments.$inferInsert;

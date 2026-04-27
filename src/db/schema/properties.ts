import { pgTable, uuid, text, timestamp, date, integer, jsonb, numeric } from 'drizzle-orm/pg-core';
import { propertyTypeEnum, lotStatusEnum } from './enums';
import { companies } from './companies';
import { documentTypes } from './document-types';
import { users } from './users';

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  type: propertyTypeEnum('type').notNull(),
  address: text('address'),
  city: text('city'),
  postalCode: text('postal_code'),
  purchaseDate: date('purchase_date'),
  purchasePrice: numeric('purchase_price', { precision: 14, scale: 2 }),
  notaire: jsonb('notaire').$type<{
    name?: string;
    etude?: string;
    phone?: string;
    email?: string;
  }>(),
  cadastre: text('cadastre'),
  storagePath: text('storage_path'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const propertyDocuments = pgTable('property_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
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

export const lots = pgTable('lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: propertyTypeEnum('type').notNull(),
  surfaceCarrez: numeric('surface_carrez', { precision: 10, scale: 2 }),
  surfaceBoutin: numeric('surface_boutin', { precision: 10, scale: 2 }),
  status: lotStatusEnum('status').notNull().default('vacant'),
  storagePath: text('storage_path'),
  photos: text('photos').array(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const lotDocuments = pgTable('lot_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'cascade' }),
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

export const levels = pgTable('levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  levelId: uuid('level_id')
    .notNull()
    .references(() => levels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  surfaceM2: numeric('surface_m2', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Lot = typeof lots.$inferSelect;
export type NewLot = typeof lots.$inferInsert;
export type Level = typeof levels.$inferSelect;
export type NewLevel = typeof levels.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type PropertyDocument = typeof propertyDocuments.$inferSelect;
export type NewPropertyDocument = typeof propertyDocuments.$inferInsert;
export type LotDocument = typeof lotDocuments.$inferSelect;
export type NewLotDocument = typeof lotDocuments.$inferInsert;

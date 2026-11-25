import { pgTable, uuid, text, timestamp, varchar, integer, boolean } from 'drizzle-orm/pg-core';

// Retours 24/11/2026 pt 6 — types de location paramétrables (Paramètres), modèle supplier_types.
// Remplace l'enum `location_type` (colonne `locations.type_location` gardée, plus écrite).
export const locationTypes = pgTable('location_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LocationType = typeof locationTypes.$inferSelect;
export type NewLocationType = typeof locationTypes.$inferInsert;

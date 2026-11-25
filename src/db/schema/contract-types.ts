import { pgTable, uuid, text, timestamp, varchar, integer, boolean } from 'drizzle-orm/pg-core';

// Retours 24/11/2026 pt 7 — types de contrat d'un lot (Eau, Électricité, Internet, Assurance…),
// paramétrables dans Paramètres. Modèle location_types.
export const contractTypes = pgTable('contract_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ContractType = typeof contractTypes.$inferSelect;
export type NewContractType = typeof contractTypes.$inferInsert;

import { pgTable, uuid, text, timestamp, varchar, integer, boolean } from 'drizzle-orm/pg-core';

export const supplierTypes = pgTable('supplier_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SupplierType = typeof supplierTypes.$inferSelect;
export type NewSupplierType = typeof supplierTypes.$inferInsert;

import { pgTable, uuid, text, boolean, integer, timestamp, varchar, unique } from 'drizzle-orm/pg-core';
import { documentScopeEnum, documentCategoryEnum } from './enums';

export const documentTypes = pgTable(
  'document_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    label: text('label').notNull(),
    scope: documentScopeEnum('scope').notNull(),
    // V1.9 Lot E — catégorie par défaut héritée par les documents de ce type
    // (override possible côté table documents).
    category: documentCategoryEnum('category'),
    // V12bis PR2 — catégorie paramétrable (FK vers document_categories table)
    categoryId: uuid('category_id'),
    // V12bis PR2 — typage par catégorie de fournisseur (scope=supplier uniquement)
    supplierTypeId: uuid('supplier_type_id'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    hasExpiration: boolean('has_expiration').notNull().default(false),
    isRequired: boolean('is_required').notNull().default(false),
    appliesToTenantType: text('applies_to_tenant_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeScopeUnique: unique('document_types_code_scope_unique').on(table.code, table.scope),
  })
);

export type DocumentType = typeof documentTypes.$inferSelect;
export type NewDocumentType = typeof documentTypes.$inferInsert;

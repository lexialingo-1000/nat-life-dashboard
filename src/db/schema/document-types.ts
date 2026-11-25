import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  varchar,
  unique,
} from 'drizzle-orm/pg-core';
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
    // V12bis PR2 — typage par catégorie de fournisseur (scope=supplier uniquement).
    // Retours 24/11 pt 12 — plusieurs types possibles. NULL/vide = tous.
    supplierTypeIds: uuid('supplier_type_ids').array(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    hasExpiration: boolean('has_expiration').notNull().default(false),
    isRequired: boolean('is_required').notNull().default(false),
    // Retours 24/11 pt 12 — types de locataire (valeurs de tenant_type : LT/CT),
    // scope=customer uniquement. NULL/vide = tous les locataires.
    appliesToTenantTypes: text('applies_to_tenant_types').array(),
    // dashboard-22 #8b — typage par type de société (scope=company uniquement).
    // Retours 24/11 pt 12 — plusieurs valeurs de company_type. NULL/vide = toutes.
    appliesToCompanyTypes: text('applies_to_company_types').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeScopeUnique: unique('document_types_code_scope_unique').on(table.code, table.scope),
  }),
);

export type DocumentType = typeof documentTypes.$inferSelect;
export type NewDocumentType = typeof documentTypes.$inferInsert;

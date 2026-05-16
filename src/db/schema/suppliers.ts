import { pgTable, uuid, text, timestamp, date, varchar, boolean } from 'drizzle-orm/pg-core';
import { supplierInvoicingTypeEnum, supplierTypeEnum, documentCategoryEnum } from './enums';
import { documentTypes } from './document-types';
import { users } from './users';

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: text('company_name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  storagePath: text('storage_path'),
  invoicingType: supplierInvoicingTypeEnum('invoicing_type').notNull().default('manual_upload'),
  type: supplierTypeEnum('type').notNull().default('autre'),
  // V12bis PR2 — type paramétrable (FK vers supplier_types table)
  typeId: uuid('type_id'),
  pennylaneSupplierId: varchar('pennylane_supplier_id', { length: 64 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const supplierContacts = pgTable('supplier_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'cascade' }),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  email: text('email'),
  function: text('function'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const supplierDocuments = pgTable('supplier_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'cascade' }),
  typeId: uuid('type_id')
    .notNull()
    .references(() => documentTypes.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  storageKey: text('storage_key').notNull(),
  documentDate: date('document_date'),
  expiresAt: date('expires_at'),
  // V1.9 Lot E — override de la catégorie héritée du type. Null = utilise type.category.
  category: documentCategoryEnum('category'),
  notes: text('notes'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
});

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type SupplierContact = typeof supplierContacts.$inferSelect;
export type NewSupplierContact = typeof supplierContacts.$inferInsert;
export type SupplierDocument = typeof supplierDocuments.$inferSelect;
export type NewSupplierDocument = typeof supplierDocuments.$inferInsert;

import { pgTable, uuid, text, timestamp, date, varchar, boolean } from 'drizzle-orm/pg-core';
import { documentTypes } from './document-types';
import { users } from './users';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: text('company_name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  storagePath: text('storage_path'),
  pennylaneCustomerId: varchar('pennylane_customer_id', { length: 64 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customerDocuments = pgTable('customer_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
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

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerDocument = typeof customerDocuments.$inferSelect;
export type NewCustomerDocument = typeof customerDocuments.$inferInsert;

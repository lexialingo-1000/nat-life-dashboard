import { pgTable, uuid, text, jsonb, timestamp, varchar, boolean, date } from 'drizzle-orm/pg-core';
import { companyTypeEnum, formeJuridiqueEnum, tvaFrequencyEnum } from './enums';
import { documentTypes } from './document-types';
import { users } from './users';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  siren: varchar('siren', { length: 9 }),
  // dashboard-22 — sociétés étrangères : immatriculation locale (hors SIREN)
  immatriculation: text('immatriculation'),
  pays: text('pays').default('FR'),
  type: companyTypeEnum('type').notNull(),
  formeJuridique: formeJuridiqueEnum('forme_juridique'),
  address: text('address'),
  activitePrincipale: text('activite_principale'),
  nafCode: varchar('naf_code', { length: 10 }),
  // V12bis PR5 A1 — numéro TVA intracom
  tvaIntracom: varchar('tva_intracom', { length: 20 }),
  // dashboard-22 (retour JC 2026-06-10) — N° TVA international, distinct de l'intracom,
  // pour sociétés étrangères. Optionnel.
  tvaInternational: varchar('tva_international', { length: 30 }),
  // V1.11 R8 — fréquence TVA (cf. enum). Null = info non renseignée.
  tvaFrequency: tvaFrequencyEnum('tva_frequency'),
  isActive: boolean('is_active').notNull().default(true),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const companyDocuments = pgTable('company_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
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

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type NewCompanyDocument = typeof companyDocuments.$inferInsert;

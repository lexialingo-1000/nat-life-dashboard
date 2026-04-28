import { pgTable, uuid, text, jsonb, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';
import { companyTypeEnum, formeJuridiqueEnum } from './enums';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  siren: varchar('siren', { length: 9 }),
  type: companyTypeEnum('type').notNull(),
  formeJuridique: formeJuridiqueEnum('forme_juridique'),
  address: text('address'),
  activitePrincipale: text('activite_principale'),
  nafCode: varchar('naf_code', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

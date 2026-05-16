import { pgTable, uuid, text, timestamp, date } from 'drizzle-orm/pg-core';
import { marcheTacheStatusEnum } from './enums';
import { lots, rooms } from './properties';
import { suppliers, supplierContacts } from './suppliers';
import { marchesTravaux, marcheSousLots } from './marches';

/**
 * Tâches d'un marché de travaux (anciennement `finitions` en V1, renommé V1.8 P2-2).
 *
 * Source : Remarques client dashboard-7 §22 (rename) + dashboard-8 §9-12
 * (Statut/Titre/emplacement/contact/photos par tâche).
 *
 * Enrich V1.8 P2-2+5 :
 * - title (renamed from `name`)
 * - photos[] (was single picture_storage_key, deprecated mais conservé)
 * - location_description (texte libre niveau/pièce)
 * - supplier_contact_id (FK vers supplier_contacts pour assigner contact spécifique)
 * - status enum élargi : a_faire / en_cours / termine (was livre) / valide (NEW)
 */
export const marcheTaches = pgTable('marche_taches', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'cascade' }),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  supplierContactId: uuid('supplier_contact_id').references(() => supplierContacts.id, {
    onDelete: 'set null',
  }),
  marcheId: uuid('marche_id').references(() => marchesTravaux.id, { onDelete: 'set null' }),
  marcheSousLotId: uuid('marche_sous_lot_id').references(() => marcheSousLots.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  description: text('description'),
  locationDescription: text('location_description'),
  photos: text('photos').array().notNull().default([]),
  /** @deprecated V1.8 — utiliser `photos[]`. Conservé pour rétrocompat, à drop en V1.8.5+. */
  pictureStorageKey: text('picture_storage_key'),
  status: marcheTacheStatusEnum('status').notNull().default('a_faire'),
  // V12bis PR4 J4 — échéance (remplace progressivement description sur les forms).
  dueDate: date('due_date'),
  completedAt: date('completed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MarcheTache = typeof marcheTaches.$inferSelect;
export type NewMarcheTache = typeof marcheTaches.$inferInsert;

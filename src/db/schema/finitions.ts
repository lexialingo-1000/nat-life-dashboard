import { pgTable, uuid, text, timestamp, date } from 'drizzle-orm/pg-core';
import { finitionStatusEnum } from './enums';
import { lots, rooms } from './properties';
import { suppliers } from './suppliers';
import { marchesTravaux, marcheSousLots } from './marches';

export const finitions = pgTable('finitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'cascade' }),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  marcheId: uuid('marche_id').references(() => marchesTravaux.id, { onDelete: 'set null' }),
  marcheSousLotId: uuid('marche_sous_lot_id').references(() => marcheSousLots.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  description: text('description'),
  pictureStorageKey: text('picture_storage_key'),
  status: finitionStatusEnum('status').notNull().default('a_faire'),
  completedAt: date('completed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Finition = typeof finitions.$inferSelect;
export type NewFinition = typeof finitions.$inferInsert;

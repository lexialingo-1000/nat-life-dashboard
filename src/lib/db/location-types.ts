/**
 * Retours 24/11/2026 pt 6 — types de location paramétrables (`location_types`, Paramètres).
 */
import { db } from '@/db/client';
import { asc, eq, or, sql } from 'drizzle-orm';
import { locations, locationTypes } from '@/db/schema';

/**
 * Libellé du type d'une location, lu dans `location_types` via `type_id` (renames admin
 * propagés), repli sur l'ancienne colonne enum `type_location`. À utiliser dans un select
 * sur `locations` : `typeLabel: locationTypeLabel`.
 */
export const locationTypeLabel = sql<string>`COALESCE(
  (SELECT lt.label FROM ${locationTypes} lt WHERE lt.id = ${locations.typeId}),
  ${locations.typeLocation}::text,
  '—'
)`;

/** Options du select « Type de location » : types actifs (+ le type courant s'il est désactivé). */
export async function loadLocationTypeOptions(
  currentTypeId?: string | null,
): Promise<{ id: string; label: string }[]> {
  return db
    .select({ id: locationTypes.id, label: locationTypes.label })
    .from(locationTypes)
    .where(
      currentTypeId
        ? or(eq(locationTypes.isActive, true), eq(locationTypes.id, currentTypeId))
        : eq(locationTypes.isActive, true),
    )
    .orderBy(asc(locationTypes.sortOrder), asc(locationTypes.label));
}

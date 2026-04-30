'use server';

import { db } from '@/db/client';
import { lots, levels, rooms, lotDocuments } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const lotUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['appartement', 'maison', 'garage', 'immeuble', 'terrain']),
  status: z.enum(['vacant', 'loue_annuel', 'loue_saisonnier', 'travaux']),
  surfaceCarrez: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  surfaceBoutin: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  notes: z.string().optional().or(z.literal('')),
});

export async function updateLotAction(formData: FormData): Promise<void> {
  const parsed = lotUpdateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    type: formData.get('type'),
    status: formData.get('status'),
    surfaceCarrez: formData.get('surfaceCarrez'),
    surfaceBoutin: formData.get('surfaceBoutin'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { id, surfaceCarrez, surfaceBoutin, notes, ...rest } = parsed.data;

  await db
    .update(lots)
    .set({
      ...rest,
      surfaceCarrez: surfaceCarrez != null ? String(surfaceCarrez) : null,
      surfaceBoutin: surfaceBoutin != null ? String(surfaceBoutin) : null,
      notes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(lots.id, id));

  revalidatePath(`/biens/lots/${id}`);
  redirect(`/biens/lots/${id}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Niveaux & pièces (vague 3 retours Natacha) — édition in-place sur fiche lot.
// Pas de redirect : les actions revalidatent le path et le form se reset.
// ──────────────────────────────────────────────────────────────────────────

const levelCreateSchema = z.object({
  lotId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

export async function createLevelAction(formData: FormData): Promise<void> {
  const parsed = levelCreateSchema.safeParse({
    lotId: formData.get('lotId'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  // Sort_order = max + 1 pour l'ordre d'affichage
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${levels.sortOrder}), -1) + 1` })
    .from(levels)
    .where(eq(levels.lotId, parsed.data.lotId));

  await db.insert(levels).values({
    lotId: parsed.data.lotId,
    name: parsed.data.name,
    sortOrder: Number(next ?? 0),
  });

  revalidatePath(`/biens/lots/${parsed.data.lotId}`);
}

export async function deleteLevelAction(formData: FormData): Promise<void> {
  const levelId = String(formData.get('levelId') ?? '');
  const lotId = String(formData.get('lotId') ?? '');
  if (!levelId || !lotId) throw new Error('IDs manquants');

  await db.delete(levels).where(eq(levels.id, levelId));
  revalidatePath(`/biens/lots/${lotId}`);
}

const roomCreateSchema = z.object({
  levelId: z.string().uuid(),
  lotId: z.string().uuid(),
  name: z.string().min(1).max(120),
  surfaceM2: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
});

export async function createRoomAction(formData: FormData): Promise<void> {
  const parsed = roomCreateSchema.safeParse({
    levelId: formData.get('levelId'),
    lotId: formData.get('lotId'),
    name: formData.get('name'),
    surfaceM2: formData.get('surfaceM2'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  await db.insert(rooms).values({
    levelId: parsed.data.levelId,
    name: parsed.data.name,
    surfaceM2: parsed.data.surfaceM2 != null ? String(parsed.data.surfaceM2) : null,
  });

  revalidatePath(`/biens/lots/${parsed.data.lotId}`);
}

export async function deleteRoomAction(formData: FormData): Promise<void> {
  const roomId = String(formData.get('roomId') ?? '');
  const lotId = String(formData.get('lotId') ?? '');
  if (!roomId || !lotId) throw new Error('IDs manquants');

  await db.delete(rooms).where(eq(rooms.id, roomId));
  revalidatePath(`/biens/lots/${lotId}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Documents lot — diagnostiques DPE/amiante, photos, etc. (V1.4.2)
// ──────────────────────────────────────────────────────────────────────────

const lotDocumentSchema = z.object({
  lotId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export async function uploadLotDocumentAction(formData: FormData): Promise<void> {
  const parsed = lotDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(lotDocuments).values({
    lotId: data.lotId,
    typeId: data.typeId,
    name: data.name,
    storageKey: data.storageKey,
    documentDate: data.documentDate || null,
    expiresAt: data.expiresAt || null,
    notes: data.notes || null,
  });
  revalidatePath(`/biens/lots/${data.lotId}`);
}

export async function deleteLotDocumentAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const lotId = String(formData.get('lotId') ?? '');
  if (!documentId || !lotId) throw new Error('IDs manquants');

  const rows = await db
    .select({ storageKey: lotDocuments.storageKey })
    .from(lotDocuments)
    .where(eq(lotDocuments.id, documentId))
    .limit(1);

  if (rows[0]?.storageKey) {
    await deleteObject(rows[0].storageKey);
  }

  await db.delete(lotDocuments).where(eq(lotDocuments.id, documentId));
  revalidatePath(`/biens/lots/${lotId}`);
}

export async function getLotDocumentUrlAction(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const storageKey = String(formData.get('storageKey') ?? '');
  if (!storageKey) return { error: 'Clé manquante' };
  try {
    const url = await getDownloadUrl(storageKey);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur MinIO' };
  }
}

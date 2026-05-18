'use server';

import { db } from '@/db/client';
import { marchesTravaux, marcheLotAffectations, marcheDocuments, marcheSousLots, marcheTaches, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildStoragePrefix } from '@/lib/storage/minio';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const marcheStatusValues = [
  'devis_recu',
  'signe',
  'en_cours',
  'livre',
  'conteste',
  'annule',
] as const;

const marcheBaseSchema = z.object({
  propertyId: z.string().uuid(),
  supplierId: z.string().uuid(),
  marcheTypeId: z
    .preprocess((v) => (v === '' || v == null ? null : v), z.string().uuid().nullable())
    .optional(),
  description: z.string().optional().or(z.literal('')),
  amountHt: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  amountTtc: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  dateDevis: z.string().optional().or(z.literal('')),
  dateSignature: z.string().optional().or(z.literal('')),
  dateDebutPrevu: z.string().optional().or(z.literal('')),
  dateFinPrevu: z.string().optional().or(z.literal('')),
  status: z.enum(marcheStatusValues).default('devis_recu'),
  notes: z.string().optional().or(z.literal('')),
});

// Whitelist des chemins internes autorisés pour `returnTo` afin d'éviter les
// open redirects. On reste sur des préfixes de l'app, jamais d'URL absolue.
function safeReturnTo(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value : '';
  if (!v.startsWith('/')) return fallback;
  if (v.startsWith('//')) return fallback;
  return v;
}

function parseLotIds(formData: FormData): string[] {
  const ids = formData.getAll('lotIds');
  return ids
    .map((v) => String(v))
    .filter((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
}

async function resolveSupplierName(supplierId: string): Promise<string> {
  const rows = await db
    .select({ companyName: suppliers.companyName, firstName: suppliers.firstName, lastName: suppliers.lastName })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  const s = rows[0];
  if (!s) return 'Fournisseur';
  return (s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || 'Fournisseur';
}

/**
 * V12bis umbrella §2 — création marché à la volée depuis un combobox (par exemple
 * sur le form upload d'un doc compta). Retourne {id, label}|{error} sans redirect.
 * Champs requis : propertyId + supplierId + name. Pas d'affectation de lots,
 * pas de dates : c'est un marché minimal, l'utilisateur l'enrichira ensuite via
 * /marches/[id]/edit.
 */
export async function createMarcheInlineAction(
  formData: FormData
): Promise<{ id: string; label: string } | { error: string }> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const supplierId = String(formData.get('supplierId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return { error: 'Bien (propertyId) invalide' };
  if (!/^[0-9a-f-]{36}$/i.test(supplierId)) return { error: 'Fournisseur (supplierId) invalide' };
  if (!name) return { error: 'Nom du marché requis' };

  const supplierName = await resolveSupplierName(supplierId);

  const inserted = await db
    .insert(marchesTravaux)
    .values({
      propertyId,
      supplierId,
      name,
      status: 'devis_recu',
      storagePath: buildStoragePrefix('marches', `${name}-${supplierName}`),
    })
    .returning({ id: marchesTravaux.id });

  revalidatePath('/marches');
  revalidatePath(`/biens/properties/${propertyId}`);
  return { id: inserted[0].id, label: name };
}

export async function createMarcheAction(formData: FormData): Promise<void> {
  const parsed = marcheBaseSchema.safeParse({
    propertyId: formData.get('propertyId'),
    supplierId: formData.get('supplierId'),
    marcheTypeId: formData.get('marcheTypeId'),
    description: formData.get('description'),
    amountHt: formData.get('amountHt'),
    amountTtc: formData.get('amountTtc'),
    dateDevis: formData.get('dateDevis'),
    dateSignature: formData.get('dateSignature'),
    dateDebutPrevu: formData.get('dateDebutPrevu'),
    dateFinPrevu: formData.get('dateFinPrevu'),
    status: formData.get('status') ?? 'devis_recu',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const data = parsed.data;
  const lotIds = parseLotIds(formData);
  const supplierName = await resolveSupplierName(data.supplierId);

  const inserted = await db
    .insert(marchesTravaux)
    .values({
      propertyId: data.propertyId,
      supplierId: data.supplierId,
      marcheTypeId: data.marcheTypeId ?? null,
      name: supplierName,
      description: data.description || null,
      amountHt: data.amountHt != null ? String(data.amountHt) : null,
      amountTtc: data.amountTtc != null ? String(data.amountTtc) : null,
      dateDevis: data.dateDevis || null,
      dateSignature: data.dateSignature || null,
      dateDebutPrevu: data.dateDebutPrevu || null,
      dateFinPrevu: data.dateFinPrevu || null,
      status: data.status,
      notes: data.notes || null,
      storagePath: buildStoragePrefix('marches', supplierName),
    })
    .returning({ id: marchesTravaux.id });

  const marcheId = inserted[0].id;

  if (lotIds.length > 0) {
    await db.insert(marcheLotAffectations).values(
      lotIds.map((lotId) => ({
        marcheId,
        lotId,
      }))
    );
  }

  revalidatePath(`/biens/properties/${data.propertyId}`);
  revalidatePath('/marches');

  const returnTo = safeReturnTo(formData.get('returnTo'), `/marches/${marcheId}`);
  redirect(returnTo);
}

const marcheUpdateSchema = marcheBaseSchema.extend({
  id: z.string().uuid(),
});

export async function updateMarcheAction(formData: FormData): Promise<void> {
  const parsed = marcheUpdateSchema.safeParse({
    id: formData.get('id'),
    propertyId: formData.get('propertyId'),
    supplierId: formData.get('supplierId'),
    marcheTypeId: formData.get('marcheTypeId'),
    description: formData.get('description'),
    amountHt: formData.get('amountHt'),
    amountTtc: formData.get('amountTtc'),
    dateDevis: formData.get('dateDevis'),
    dateSignature: formData.get('dateSignature'),
    dateDebutPrevu: formData.get('dateDebutPrevu'),
    dateFinPrevu: formData.get('dateFinPrevu'),
    status: formData.get('status') ?? 'devis_recu',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { id, ...data } = parsed.data;
  const lotIds = parseLotIds(formData);
  const supplierName = await resolveSupplierName(data.supplierId);

  await db
    .update(marchesTravaux)
    .set({
      propertyId: data.propertyId,
      supplierId: data.supplierId,
      marcheTypeId: data.marcheTypeId ?? null,
      name: supplierName,
      description: data.description || null,
      amountHt: data.amountHt != null ? String(data.amountHt) : null,
      amountTtc: data.amountTtc != null ? String(data.amountTtc) : null,
      dateDevis: data.dateDevis || null,
      dateSignature: data.dateSignature || null,
      dateDebutPrevu: data.dateDebutPrevu || null,
      dateFinPrevu: data.dateFinPrevu || null,
      status: data.status,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(marchesTravaux.id, id));

  // Resync affectations : delete all, re-insert
  await db.delete(marcheLotAffectations).where(eq(marcheLotAffectations.marcheId, id));
  if (lotIds.length > 0) {
    await db.insert(marcheLotAffectations).values(
      lotIds.map((lotId) => ({
        marcheId: id,
        lotId,
      }))
    );
  }

  revalidatePath(`/marches/${id}`);
  revalidatePath(`/biens/properties/${data.propertyId}`);
  revalidatePath('/marches');
  redirect(`/marches/${id}`);
}

export async function deleteMarcheAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const rows = await db
    .select({ propertyId: marchesTravaux.propertyId })
    .from(marchesTravaux)
    .where(eq(marchesTravaux.id, id))
    .limit(1);

  await db.delete(marchesTravaux).where(eq(marchesTravaux.id, id));

  if (rows[0]?.propertyId) {
    revalidatePath(`/biens/properties/${rows[0].propertyId}`);
  }
  revalidatePath('/marches');
  redirect('/marches');
}

const marcheDocumentSchema = z.object({
  marcheId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  category: z.enum(['notaire','banque','juridique','comptabilite','courant','location']).optional().or(z.literal('')),
});

export async function uploadMarcheDocumentAction(formData: FormData): Promise<void> {
  const parsed = marcheDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(marcheDocuments).values({
    marcheId: data.marcheId,
    typeId: data.typeId,
    name: data.name,
    storageKey: data.storageKey,
    documentDate: data.documentDate || null,
    expiresAt: data.expiresAt || null,
    notes: data.notes || null,
    category: data.category || null,
  });
  revalidatePath(`/marches/${data.marcheId}`);
}

export async function deleteMarcheDocumentAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const marcheId = String(formData.get('marcheId') ?? '');
  if (!documentId || !marcheId) throw new Error('IDs manquants');

  const rows = await db
    .select({ storageKey: marcheDocuments.storageKey })
    .from(marcheDocuments)
    .where(eq(marcheDocuments.id, documentId))
    .limit(1);

  if (rows[0]?.storageKey) {
    await deleteObject(rows[0].storageKey);
  }

  await db.delete(marcheDocuments).where(eq(marcheDocuments.id, documentId));
  revalidatePath(`/marches/${marcheId}`);
}

export async function getMarcheDocumentUrlAction(
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

export async function createSousLotAction(formData: FormData): Promise<void> {
  const marcheId = String(formData.get('marcheId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!marcheId || !name) throw new Error('Champs obligatoires manquants');

  const amountHtRaw = formData.get('amountHt');
  const amountHt =
    amountHtRaw !== '' && amountHtRaw != null ? String(Number(amountHtRaw)) : null;

  await db.insert(marcheSousLots).values({ marcheId, name, amountHt });
  revalidatePath(`/marches/${marcheId}`);
}

export async function deleteSousLotAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const marcheId = String(formData.get('marcheId') ?? '');
  if (!id) throw new Error('ID manquant');

  await db.delete(marcheSousLots).where(eq(marcheSousLots.id, id));
  revalidatePath(`/marches/${marcheId}`);
}

// V12bis PR9 §6 — modifier un sous-lot (retours Natacha dashboard-13).
const sousLotUpdateSchema = z.object({
  id: z.string().uuid(),
  marcheId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().or(z.literal('')),
  marcheTypeId: z
    .preprocess((v) => (v === '' || v == null ? null : v), z.string().uuid().nullable())
    .optional(),
  amountHt: z
    .preprocess(
      (v) => (v === '' || v == null ? null : v),
      z.union([z.string(), z.number()]).nullable()
    )
    .optional(),
  amountTtc: z
    .preprocess(
      (v) => (v === '' || v == null ? null : v),
      z.union([z.string(), z.number()]).nullable()
    )
    .optional(),
  status: z
    .enum(['devis_recu', 'signe', 'en_cours', 'livre', 'conteste', 'annule'])
    .optional()
    .default('devis_recu'),
  dateDebutPrevu: z.string().optional().or(z.literal('')),
  dateFinPrevu: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export async function updateSousLotAction(formData: FormData): Promise<void> {
  const parsed = sousLotUpdateSchema.safeParse({
    id: formData.get('id'),
    marcheId: formData.get('marcheId'),
    name: formData.get('name'),
    description: formData.get('description'),
    marcheTypeId: formData.get('marcheTypeId'),
    amountHt: formData.get('amountHt'),
    amountTtc: formData.get('amountTtc'),
    status: formData.get('status') ?? 'devis_recu',
    dateDebutPrevu: formData.get('dateDebutPrevu'),
    dateFinPrevu: formData.get('dateFinPrevu'),
    notes: formData.get('notes'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db
    .update(marcheSousLots)
    .set({
      name: data.name,
      description: data.description || null,
      marcheTypeId: data.marcheTypeId ?? null,
      amountHt: data.amountHt != null ? String(data.amountHt) : null,
      amountTtc: data.amountTtc != null ? String(data.amountTtc) : null,
      status: data.status,
      dateDebutPrevu: data.dateDebutPrevu || null,
      dateFinPrevu: data.dateFinPrevu || null,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(marcheSousLots.id, data.id));
  revalidatePath(`/marches/${data.marcheId}`);
  redirect(`/marches/${data.marcheId}`);
}

// === V1.8 P2-3+4 : Tâches dans sous-lots de marché ===========================

const tacheStatusValues = ['a_faire', 'en_cours', 'termine', 'valide'] as const;

const tacheCreateSchema = z.object({
  marcheSousLotId: z.string().uuid(),
  lotId: z.string().uuid(),
  title: z.string().min(1).max(255),
  // V1.10 hotfix — preprocess null (FormData.get retourne null si champ absent du form).
  // Pré-existant : z.string().optional().or(z.literal('')) rejetait null → "Invalid input".
  description: z
    .preprocess((v) => (v == null ? '' : v), z.string())
    .optional(),
  // V12bis umbrella §7 — locationDescription remplacé par roomId dans le form.
  // Le schema le garde pour compat ancienne UI / API, mais accepte null/absent.
  locationDescription: z
    .preprocess((v) => (v == null ? '' : v), z.string())
    .optional(),
  // V12bis umbrella §7 — FK pièce (niveau via JOIN rooms→levels) remplace
  // l'ancien champ libre `locationDescription`. Optionnel.
  roomId: z
    .preprocess((v) => (v === '' || v == null ? null : v), z.string().uuid().nullable())
    .optional(),
  supplierContactId: z
    .preprocess((v) => (v === '' || v == null ? null : v), z.string().uuid().nullable())
    .optional(),
  status: z.enum(tacheStatusValues).default('a_faire'),
  // V12bis PR4 J4
  dueDate: z
    .preprocess((v) => (v === '' || v == null ? null : v), z.string().nullable())
    .optional(),
});

const tacheUpdateSchema = tacheCreateSchema.extend({
  id: z.string().uuid(),
});

// V1.10 §9 — useFormState pattern : retourne {status, message} en cas d'erreur
// (Zod ou DB), throw redirect en cas de succès. Évite le digest opaque Next.js
// quand le throw nu était capturé par l'error boundary.
export type CreateTacheState =
  | { status: 'idle' }
  | { status: 'error'; message: string };

export async function createTacheAction(
  _prev: CreateTacheState,
  formData: FormData
): Promise<CreateTacheState> {
  const parsed = tacheCreateSchema.safeParse({
    marcheSousLotId: formData.get('marcheSousLotId'),
    lotId: formData.get('lotId'),
    title: formData.get('title'),
    description: formData.get('description'),
    locationDescription: formData.get('locationDescription'),
    roomId: formData.get('roomId'),
    supplierContactId: formData.get('supplierContactId'),
    status: formData.get('status') ?? 'a_faire',
    dueDate: formData.get('dueDate'),
  });
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((e) => `${e.path.join('.') || 'champ'} : ${e.message}`)
      .join(' · ');
    console.error('[createTacheAction] validation error:', message);
    return { status: 'error', message };
  }
  const data = parsed.data;

  try {
    await db.insert(marcheTaches).values({
      marcheSousLotId: data.marcheSousLotId,
      lotId: data.lotId,
      title: data.title,
      description: data.description || null,
      locationDescription: data.locationDescription || null,
      roomId: data.roomId || null,
      supplierContactId: data.supplierContactId || null,
      status: data.status,
      dueDate: data.dueDate || null,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[createTacheAction] DB insert error:', { code, detail });
    let message = `Erreur création tâche : ${detail}`;
    if (code === '23503') {
      message =
        'Impossible de créer la tâche : référence invalide (lot, sous-lot, pièce ou contact). Rafraîchis la page et réessaie.';
    } else if (code === '23502') {
      message = 'Impossible de créer la tâche : un champ obligatoire est vide.';
    }
    return { status: 'error', message };
  }

  const returnTo = formData.get('returnTo');
  revalidatePath('/biens');
  redirect(safeReturnTo(returnTo, '/biens'));
}

export async function updateTacheAction(formData: FormData): Promise<void> {
  const parsed = tacheUpdateSchema.safeParse({
    id: formData.get('id'),
    marcheSousLotId: formData.get('marcheSousLotId'),
    lotId: formData.get('lotId'),
    title: formData.get('title'),
    description: formData.get('description'),
    locationDescription: formData.get('locationDescription'),
    roomId: formData.get('roomId'),
    supplierContactId: formData.get('supplierContactId'),
    status: formData.get('status') ?? 'a_faire',
    dueDate: formData.get('dueDate'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;

  await db
    .update(marcheTaches)
    .set({
      lotId: data.lotId,
      title: data.title,
      description: data.description || null,
      locationDescription: data.locationDescription || null,
      // V12bis umbrella §7 — FK pièce ajoutée (NIVEAU + PIECES filtrés côté UI).
      roomId: data.roomId || null,
      supplierContactId: data.supplierContactId || null,
      status: data.status,
      // V12bis PR9 §6 — dueDate était omis du UPDATE (orphelin) ; corrigé pour
      // que la modification depuis le form /edit persiste.
      dueDate: data.dueDate || null,
      updatedAt: new Date(),
    })
    .where(eq(marcheTaches.id, data.id));

  const returnTo = formData.get('returnTo');
  revalidatePath('/biens');
  redirect(safeReturnTo(returnTo, '/biens'));
}

export async function deleteTacheAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  await db.delete(marcheTaches).where(eq(marcheTaches.id, id));

  const returnTo = formData.get('returnTo');
  revalidatePath('/biens');
  if (returnTo && typeof returnTo === 'string') redirect(safeReturnTo(returnTo, '/biens'));
}

/**
 * Inline status update — appelé depuis le `<select>` dropdown du composant
 * `<TacheStatusSelect>`. Submit via useTransition, pas de redirect.
 */
export async function updateTacheStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id) throw new Error('ID manquant');
  if (!tacheStatusValues.includes(status as any)) {
    throw new Error(`Statut invalide : ${status}`);
  }

  await db
    .update(marcheTaches)
    .set({
      status: status as (typeof tacheStatusValues)[number],
      completedAt: status === 'termine' || status === 'valide' ? new Date().toISOString().slice(0, 10) : null,
      updatedAt: new Date(),
    })
    .where(eq(marcheTaches.id, id));

  revalidatePath('/biens');
}

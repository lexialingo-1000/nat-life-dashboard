import { db } from '@/db/client';
import {
  marcheTaches,
  marcheSousLots,
  marchesTravaux,
  marcheLotAffectations,
  lots,
  supplierContacts,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { updateTacheAction } from '@/app/(dashboard)/marches/actions';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: 'a_faire', label: 'À faire' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'valide', label: 'Validé' },
];

// V12bis PR9 §6 — Modifier une tâche (retours Natacha dashboard-13).
export default async function EditTachePage({
  params,
  searchParams,
}: {
  params: { id: string; sousLotId: string; tacheId: string };
  searchParams: { returnTo?: string };
}) {
  const rows = await db
    .select({
      id: marcheTaches.id,
      title: marcheTaches.title,
      description: marcheTaches.description,
      locationDescription: marcheTaches.locationDescription,
      supplierContactId: marcheTaches.supplierContactId,
      status: marcheTaches.status,
      dueDate: marcheTaches.dueDate,
      lotId: marcheTaches.lotId,
      marcheSousLotId: marcheTaches.marcheSousLotId,
      marcheId: marchesTravaux.id,
      marcheSupplierId: marchesTravaux.supplierId,
    })
    .from(marcheTaches)
    .innerJoin(marcheSousLots, eq(marcheSousLots.id, marcheTaches.marcheSousLotId))
    .innerJoin(marchesTravaux, eq(marchesTravaux.id, marcheSousLots.marcheId))
    .where(eq(marcheTaches.id, params.tacheId))
    .limit(1);

  if (rows.length === 0) notFound();
  const t = rows[0];

  // Lots affectés au marché → choix du lot rattaché
  const affectations = await db
    .select({ lotId: marcheLotAffectations.lotId, lotName: lots.name })
    .from(marcheLotAffectations)
    .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
    .where(eq(marcheLotAffectations.marcheId, t.marcheId))
    .orderBy(asc(lots.name));

  // Contacts fournisseur (si marché a un fournisseur)
  const contacts = t.marcheSupplierId
    ? await db
        .select({
          id: supplierContacts.id,
          firstName: supplierContacts.firstName,
          lastName: supplierContacts.lastName,
        })
        .from(supplierContacts)
        .where(eq(supplierContacts.supplierId, t.marcheSupplierId))
        .orderBy(asc(supplierContacts.lastName))
    : [];

  const returnTo = searchParams.returnTo ?? `/marches/${t.marcheId}`;

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref={returnTo} label="Retour" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Marché · Sous-lot · Tâche
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier</span>{' '}
          <span className="text-zinc-900">{t.title}</span>
        </h1>
      </header>

      <form action={updateTacheAction} className="card space-y-5 p-6" autoComplete="off">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="marcheSousLotId" value={t.marcheSousLotId ?? params.sousLotId} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Titre *</label>
          <input
            name="title"
            required
            defaultValue={t.title ?? ''}
            className="input mt-1"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Échéance</label>
            <input
              type="date"
              name="dueDate"
              defaultValue={t.dueDate ?? ''}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Statut</label>
            <select name="status" defaultValue={t.status} className="input mt-1">
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Emplacement</label>
          <input
            name="locationDescription"
            defaultValue={t.locationDescription ?? ''}
            className="input mt-1"
            placeholder="Lot 1 · RDC · Salle de bain"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Lot rattaché *</label>
            <select name="lotId" required defaultValue={t.lotId} className="input mt-1">
              {affectations.length === 0 ? (
                <option value={t.lotId}>(lot actuel)</option>
              ) : (
                affectations.map((a) => (
                  <option key={a.lotId} value={a.lotId}>
                    {a.lotName}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Contact fournisseur
            </label>
            <select
              name="supplierContactId"
              defaultValue={t.supplierContactId ?? ''}
              className="input mt-1"
            >
              <option value="">— Aucun contact spécifique —</option>
              {contacts.map((c) => {
                const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';
                return (
                  <option key={c.id} value={c.id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Description</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={t.description ?? ''}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={returnTo} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

import { db } from '@/db/client';
import {
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
import { createTacheAction } from '@/app/(dashboard)/marches/actions';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: 'a_faire', label: 'À faire' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'valide', label: 'Validé' },
];

export default async function NewTachePage({
  params,
  searchParams,
}: {
  params: { id: string; sousLotId: string };
  searchParams: { returnTo?: string };
}) {
  // Fetch sous-lot + marché + first affected lot (lotId requis pour tâche FK)
  const sousLotRow = await db
    .select({
      id: marcheSousLots.id,
      name: marcheSousLots.name,
      marcheId: marcheSousLots.marcheId,
      supplierId: marchesTravaux.supplierId,
    })
    .from(marcheSousLots)
    .innerJoin(marchesTravaux, eq(marchesTravaux.id, marcheSousLots.marcheId))
    .where(eq(marcheSousLots.id, params.sousLotId))
    .limit(1);

  if (sousLotRow.length === 0) notFound();
  const sousLot = sousLotRow[0];

  // Pick first affected lot (parties communes = pas de lotId, utiliser un lot du bien)
  const affectations = await db
    .select({ lotId: marcheLotAffectations.lotId, lotName: lots.name })
    .from(marcheLotAffectations)
    .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
    .where(eq(marcheLotAffectations.marcheId, sousLot.marcheId))
    .orderBy(asc(lots.name));

  // Fetch supplier contacts pour dropdown contact
  const contacts = sousLot.supplierId
    ? await db
        .select({
          id: supplierContacts.id,
          firstName: supplierContacts.firstName,
          lastName: supplierContacts.lastName,
        })
        .from(supplierContacts)
        .where(eq(supplierContacts.supplierId, sousLot.supplierId))
        .orderBy(asc(supplierContacts.lastName))
    : [];

  const returnTo = searchParams.returnTo ?? `/marches/${sousLot.marcheId}`;

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref={returnTo} label="Retour" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Patrimoine · Marchés · Sous-lot {sousLot.name}
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Nouvelle tâche</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Tâche concrète à exécuter dans le cadre du sous-lot. Photos, contact et emplacement
          précis renseignables.
        </p>
      </header>

      <form action={createTacheAction} className="card space-y-5 p-6">
        <input type="hidden" name="marcheSousLotId" value={sousLot.id} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Titre *</label>
          <input
            name="title"
            required
            className="input mt-1"
            placeholder="Carrelage salle de bain RDC"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Échéance</label>
            <input
              type="date"
              name="dueDate"
              className="input mt-1"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Date limite prévue pour la tâche.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Description</label>
            <textarea
              name="description"
              rows={2}
              className="input mt-1"
              placeholder="Détails (optionnel)"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Emplacement</label>
          <input
            name="locationDescription"
            className="input mt-1"
            placeholder="Lot 1 · RDC · Salle de bain"
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Texte libre — décrivez précisément où dans le bien.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Lot rattaché *</label>
            <select name="lotId" required className="input mt-1">
              {affectations.length === 0 ? (
                <option value="">— Aucun lot affecté au marché —</option>
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
            <label className="block text-[12px] font-medium text-zinc-700">Statut initial</label>
            <select name="status" defaultValue="a_faire" className="input mt-1">
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">
            Contact fournisseur
          </label>
          <select name="supplierContactId" defaultValue="" className="input mt-1">
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
          {contacts.length === 0 && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Aucun contact enregistré sur ce fournisseur.
            </p>
          )}
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[12px] text-zinc-500">
          📷 <strong>Photos</strong> — l'upload est différé en V1.8.5 (drag-drop multi-photos via
          MinIO). Pour l'instant, ajoute la tâche puis uploade les photos depuis la fiche tâche
          quand l'UI sera prête.
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={returnTo} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary" disabled={affectations.length === 0}>
            <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Créer la tâche
          </button>
        </div>
      </form>
    </div>
  );
}

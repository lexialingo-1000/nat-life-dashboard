import { db } from '@/db/client';
import {
  marcheSousLots,
  marchesTravaux,
  marcheLotAffectations,
  lots,
  levels,
  rooms,
  supplierContacts,
} from '@/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { createTacheAction } from '@/app/(dashboard)/marches/actions';
import { TacheLotLocationFieldset } from '@/components/tache-lot-location-fieldset';

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

  // V12bis umbrella §7 — niveaux + pièces des lots affectés au marché
  // (pour selects NIVEAU/PIECES filtrés dans le form).
  const lotIds = affectations.map((a) => a.lotId);
  const levelsRows =
    lotIds.length > 0
      ? await db
          .select({
            lotId: levels.lotId,
            id: levels.id,
            name: levels.name,
            sortOrder: levels.sortOrder,
          })
          .from(levels)
          .where(inArray(levels.lotId, lotIds))
          .orderBy(asc(levels.lotId), asc(levels.sortOrder), asc(levels.name))
      : [];
  const levelIds = levelsRows.map((l) => l.id);
  const roomsRows =
    levelIds.length > 0
      ? await db
          .select({
            id: rooms.id,
            name: rooms.name,
            levelId: rooms.levelId,
            sortOrder: rooms.sortOrder,
          })
          .from(rooms)
          .where(inArray(rooms.levelId, levelIds))
          .orderBy(asc(rooms.sortOrder), asc(rooms.name))
      : [];
  const roomsByLevel = new Map<string, { id: string; name: string }[]>();
  for (const r of roomsRows) {
    const list = roomsByLevel.get(r.levelId) ?? [];
    list.push({ id: r.id, name: r.name });
    roomsByLevel.set(r.levelId, list);
  }
  const levelsByLot = new Map<string, { id: string; name: string; rooms: { id: string; name: string }[] }[]>();
  for (const lvl of levelsRows) {
    const list = levelsByLot.get(lvl.lotId) ?? [];
    list.push({ id: lvl.id, name: lvl.name, rooms: roomsByLevel.get(lvl.id) ?? [] });
    levelsByLot.set(lvl.lotId, list);
  }
  const lotsStructure = lotIds.map((id) => ({ lotId: id, levels: levelsByLot.get(id) ?? [] }));
  const lotOptions = affectations.map((a) => ({ id: a.lotId, name: a.lotName }));

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

        {/* V12bis umbrella §7 — LOT RATTACHE en haut, puis NIVEAU+PIECE filtrés (live). */}
        <TacheLotLocationFieldset
          lotOptions={lotOptions}
          lotsStructure={lotsStructure}
          required
        />

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

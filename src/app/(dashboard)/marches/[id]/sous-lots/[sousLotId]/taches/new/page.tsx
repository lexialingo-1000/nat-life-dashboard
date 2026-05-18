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
import { BackLink } from '@/components/back-link';
import { TacheCreateForm } from './tache-create-form';

export const dynamic = 'force-dynamic';

export default async function NewTachePage({
  params,
  searchParams,
}: {
  params: { id: string; sousLotId: string };
  searchParams: { returnTo?: string };
}) {
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

  const affectations = await db
    .select({ lotId: marcheLotAffectations.lotId, lotName: lots.name })
    .from(marcheLotAffectations)
    .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
    .where(eq(marcheLotAffectations.marcheId, sousLot.marcheId))
    .orderBy(asc(lots.name));

  // V12bis umbrella §7 — niveaux + pièces des lots affectés au marché
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
  const levelsByLot = new Map<
    string,
    { id: string; name: string; rooms: { id: string; name: string }[] }[]
  >();
  for (const lvl of levelsRows) {
    const list = levelsByLot.get(lvl.lotId) ?? [];
    list.push({ id: lvl.id, name: lvl.name, rooms: roomsByLevel.get(lvl.id) ?? [] });
    levelsByLot.set(lvl.lotId, list);
  }
  const lotsStructure = lotIds.map((id) => ({
    lotId: id,
    levels: levelsByLot.get(id) ?? [],
  }));
  const lotOptions = affectations.map((a) => ({ id: a.lotId, name: a.lotName }));

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

      <TacheCreateForm
        sousLotId={sousLot.id}
        returnTo={returnTo}
        lotOptions={lotOptions}
        lotsStructure={lotsStructure}
        contacts={contacts}
      />
    </div>
  );
}

import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheSousLots,
  marcheLotAffectations,
  marcheTypes,
  lots,
  levels,
  rooms,
  properties,
  suppliers,
} from '@/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { BackLink } from '@/components/back-link';
import { createMarcheInlineAction, createSousLotInlineAction } from '../../marches/actions';
import {
  TacheCreateSelectableForm,
  type MarcheOption,
  type SousLotOption,
  type LotOption,
  type SupplierOption,
} from './tache-create-selectable-form';

export const dynamic = 'force-dynamic';

// V20 §FICHE LOT §4 — ajout d'une tâche depuis n'importe quel contexte
// (fiche lot / fournisseur / bien). Le marché et le sous-lot sont choisis dans
// le formulaire. Le contexte (lotId / supplierId / propertyId) pré-filtre la
// liste des marchés et pré-sélectionne le lot.

interface SearchParams {
  lotId?: string;
  supplierId?: string;
  propertyId?: string;
  returnTo?: string;
}

export default async function NewTachePage({ searchParams }: { searchParams: SearchParams }) {
  const { lotId, supplierId, propertyId } = searchParams;
  const returnTo = searchParams.returnTo ?? '/biens';

  // 1. Marchés en périmètre selon le contexte.
  let marcheRows: MarcheOption[];
  if (lotId) {
    marcheRows = await db
      .select({
        id: marchesTravaux.id,
        name: marchesTravaux.name,
        propertyId: marchesTravaux.propertyId,
        propertyName: properties.name,
      })
      .from(marcheLotAffectations)
      .innerJoin(marchesTravaux, eq(marchesTravaux.id, marcheLotAffectations.marcheId))
      .innerJoin(properties, eq(properties.id, marchesTravaux.propertyId))
      .where(eq(marcheLotAffectations.lotId, lotId))
      .orderBy(asc(marchesTravaux.name));
  } else {
    const base = db
      .select({
        id: marchesTravaux.id,
        name: marchesTravaux.name,
        propertyId: marchesTravaux.propertyId,
        propertyName: properties.name,
      })
      .from(marchesTravaux)
      .innerJoin(properties, eq(properties.id, marchesTravaux.propertyId));
    if (supplierId) {
      marcheRows = await base
        .where(eq(marchesTravaux.supplierId, supplierId))
        .orderBy(asc(marchesTravaux.name));
    } else if (propertyId) {
      marcheRows = await base
        .where(eq(marchesTravaux.propertyId, propertyId))
        .orderBy(asc(marchesTravaux.name));
    } else {
      marcheRows = await base.orderBy(asc(marchesTravaux.name));
    }
  }

  // Dédup (un marché peut apparaître plusieurs fois via affectations multi-lot).
  const marchesMap = new Map<string, MarcheOption>();
  for (const m of marcheRows) if (!marchesMap.has(m.id)) marchesMap.set(m.id, m);
  const marches = Array.from(marchesMap.values());
  const marcheIds = marches.map((m) => m.id);
  const propertyIds = Array.from(new Set(marches.map((m) => m.propertyId)));

  // 2. Sous-lots par marché.
  const sousLotsByMarche: Record<string, SousLotOption[]> = {};
  if (marcheIds.length > 0) {
    const sousLotRows = await db
      .select({
        id: marcheSousLots.id,
        name: marcheSousLots.name,
        marcheId: marcheSousLots.marcheId,
      })
      .from(marcheSousLots)
      .where(inArray(marcheSousLots.marcheId, marcheIds))
      .orderBy(asc(marcheSousLots.sortOrder), asc(marcheSousLots.name));
    for (const s of sousLotRows) {
      (sousLotsByMarche[s.marcheId] ??= []).push({ id: s.id, name: s.name });
    }
  }

  // 3. Lots par bien — chargés pour TOUS les biens : un marché créé à la volée
  // (V12.1) peut viser n'importe quel bien, le select Lot doit avoir ses lots.
  void propertyIds; // (le scoping se fait côté client via le bien du marché)
  const lotsByProperty: Record<string, LotOption[]> = {};
  {
    const lotRows = await db
      .select({ id: lots.id, name: lots.name, propertyId: lots.propertyId })
      .from(lots)
      .orderBy(asc(lots.name));
    for (const l of lotRows) {
      (lotsByProperty[l.propertyId] ??= []).push({ id: l.id, name: l.name });
    }
  }

  // 3b. dashboard-24 — structure niveau/pièces par lot, pour les sélecteurs
  // Niveau + Pièce désormais affichés dès la création (étaient seulement en
  // édition). Mêmes données que la page d'édition de tâche.
  const levelRows = await db
    .select({ lotId: levels.lotId, id: levels.id, name: levels.name })
    .from(levels)
    .orderBy(asc(levels.lotId), asc(levels.sortOrder), asc(levels.name));
  const levelIds = levelRows.map((l) => l.id);
  const roomRows =
    levelIds.length > 0
      ? await db
          .select({ id: rooms.id, name: rooms.name, levelId: rooms.levelId })
          .from(rooms)
          .where(inArray(rooms.levelId, levelIds))
          .orderBy(asc(rooms.sortOrder), asc(rooms.name))
      : [];
  const roomsByLevel = new Map<string, { id: string; name: string }[]>();
  for (const r of roomRows) {
    (roomsByLevel.get(r.levelId) ?? roomsByLevel.set(r.levelId, []).get(r.levelId)!).push({
      id: r.id,
      name: r.name,
    });
  }
  const levelsByLot = new Map<
    string,
    { id: string; name: string; rooms: { id: string; name: string }[] }[]
  >();
  for (const lvl of levelRows) {
    (levelsByLot.get(lvl.lotId) ?? levelsByLot.set(lvl.lotId, []).get(lvl.lotId)!).push({
      id: lvl.id,
      name: lvl.name,
      rooms: roomsByLevel.get(lvl.id) ?? [],
    });
  }
  const lotsStructure = Array.from(levelsByLot, ([lotStructLotId, lvls]) => ({
    lotId: lotStructLotId,
    levels: lvls,
  }));

  // 4. Fournisseurs actifs + tous les biens — pour la création de marché à la volée (V12.1).
  const supplierRows = await db
    .select({
      id: suppliers.id,
      companyName: suppliers.companyName,
      firstName: suppliers.firstName,
      lastName: suppliers.lastName,
      isActive: suppliers.isActive,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.companyName));
  const supplierOpts: SupplierOption[] = supplierRows
    .filter((s) => s.isActive)
    .map((s) => ({
      id: s.id,
      label: s.companyName || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Fournisseur',
    }));

  const propertyRows = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .orderBy(asc(properties.name));
  const propertyOpts: SupplierOption[] = propertyRows.map((p) => ({ id: p.id, label: p.name }));

  // dashboard-23 R4 — types de marché actifs, pour le select du dialog « créer à la volée ».
  const marcheTypeRows = await db
    .select({ id: marcheTypes.id, label: marcheTypes.label })
    .from(marcheTypes)
    .where(eq(marcheTypes.isActive, true))
    .orderBy(asc(marcheTypes.sortOrder), asc(marcheTypes.label));
  const marcheTypeOpts: SupplierOption[] = marcheTypeRows.map((t) => ({ id: t.id, label: t.label }));

  const defaultMarcheId = marches.length === 1 ? marches[0].id : undefined;

  return (
    <div className="space-y-6">
      <BackLink fallbackHref={returnTo} label="Retour" />
      <div>
        <h1 className="text-[22px] font-medium tracking-tight text-zinc-900">
          Nouvelle tâche de suivi
        </h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Choisissez le marché et le sous-lot concernés, puis décrivez la tâche.
        </p>
      </div>
      <TacheCreateSelectableForm
        marches={marches}
        sousLotsByMarche={sousLotsByMarche}
        lotsByProperty={lotsByProperty}
        lotsStructure={lotsStructure}
        suppliers={supplierOpts}
        properties={propertyOpts}
        marcheTypes={marcheTypeOpts}
        createMarcheAction={createMarcheInlineAction}
        createSousLotAction={createSousLotInlineAction}
        defaultMarcheId={defaultMarcheId}
        defaultLotId={lotId}
        returnTo={returnTo}
      />
    </div>
  );
}

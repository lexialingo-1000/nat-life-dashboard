import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheSousLots,
  marcheLotAffectations,
  lots,
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

export default async function NewTachePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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
      marcheRows = await base.where(eq(marchesTravaux.supplierId, supplierId)).orderBy(
        asc(marchesTravaux.name)
      );
    } else if (propertyId) {
      marcheRows = await base.where(eq(marchesTravaux.propertyId, propertyId)).orderBy(
        asc(marchesTravaux.name)
      );
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
        suppliers={supplierOpts}
        properties={propertyOpts}
        createMarcheAction={createMarcheInlineAction}
        createSousLotAction={createSousLotInlineAction}
        defaultMarcheId={defaultMarcheId}
        defaultLotId={lotId}
        returnTo={returnTo}
      />
    </div>
  );
}

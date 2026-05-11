import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheLotAffectations,
  properties,
  lots,
  suppliers,
  marcheTypes,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { updateMarcheAction } from '../../actions';
import { createSupplierInlineAction } from '../../../fournisseurs/actions';
import { MarcheForm } from '@/components/marche-form';

export const dynamic = 'force-dynamic';

export default async function EditMarchePage({ params }: { params: { id: string } }) {
  const rows = await db
    .select({
      id: marchesTravaux.id,
      propertyId: marchesTravaux.propertyId,
      supplierId: marchesTravaux.supplierId,
      description: marchesTravaux.description,
      amountHt: marchesTravaux.amountHt,
      amountTtc: marchesTravaux.amountTtc,
      dateDevis: marchesTravaux.dateDevis,
      dateSignature: marchesTravaux.dateSignature,
      dateDebutPrevu: marchesTravaux.dateDebutPrevu,
      dateFinPrevu: marchesTravaux.dateFinPrevu,
      status: marchesTravaux.status,
      notes: marchesTravaux.notes,
      marcheTypeId: marchesTravaux.marcheTypeId,
      propertyName: properties.name,
    })
    .from(marchesTravaux)
    .innerJoin(properties, eq(marchesTravaux.propertyId, properties.id))
    .where(eq(marchesTravaux.id, params.id))
    .limit(1);

  if (rows.length === 0) notFound();
  const marche = rows[0];

  const propertyLots = await db
    .select({ id: lots.id, name: lots.name })
    .from(lots)
    .where(eq(lots.propertyId, marche.propertyId))
    .orderBy(asc(lots.name));

  const supplierRows = await db
    .select({
      id: suppliers.id,
      companyName: suppliers.companyName,
      firstName: suppliers.firstName,
      lastName: suppliers.lastName,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.companyName));

  const supplierOptions = supplierRows.map((s) => ({
    id: s.id,
    label:
      s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? 'Fournisseur',
  }));

  const affectations = await db
    .select({ lotId: marcheLotAffectations.lotId })
    .from(marcheLotAffectations)
    .where(eq(marcheLotAffectations.marcheId, marche.id));

  const marcheTypeRows = await db
    .select({ id: marcheTypes.id, label: marcheTypes.label })
    .from(marcheTypes)
    .where(eq(marcheTypes.isActive, true))
    .orderBy(asc(marcheTypes.sortOrder));

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink fallbackHref={`/marches/${marche.id}`} label="Marché de travaux" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modifier le marché</h1>
      </div>

      <MarcheForm
        action={updateMarcheAction}
        propertyId={marche.propertyId}
        propertyName={marche.propertyName}
        lots={propertyLots}
        suppliers={supplierOptions}
        marcheTypes={marcheTypeRows}
        defaultValues={{
          id: marche.id,
          supplierId: marche.supplierId,
          marcheTypeId: marche.marcheTypeId,
          description: marche.description,
          amountHt: marche.amountHt,
          amountTtc: marche.amountTtc,
          dateDevis: marche.dateDevis,
          dateSignature: marche.dateSignature,
          dateDebutPrevu: marche.dateDebutPrevu,
          dateFinPrevu: marche.dateFinPrevu,
          status: marche.status,
          notes: marche.notes,
          lotIds: affectations.map((a) => a.lotId),
        }}
        cancelHref={`/marches/${marche.id}`}
        submitLabel="Enregistrer"
        createSupplierAction={createSupplierInlineAction}
      />
    </div>
  );
}

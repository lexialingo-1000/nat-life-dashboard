import { db } from '@/db/client';
import { properties, lots, suppliers, marcheTypes } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { createMarcheAction } from '../actions';
import { createSupplierInlineAction } from '../../fournisseurs/actions';
import { MarcheForm } from '@/components/marche-form';
import { EntityCombobox } from '@/components/entity-combobox';

export const dynamic = 'force-dynamic';

export default async function NewMarchePage({
  searchParams,
}: {
  searchParams: { propertyId?: string; supplierId?: string };
}) {
  const selectedPropertyId = searchParams.propertyId;
  const prefillSupplierId = searchParams.supplierId;

  const propertyList = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .orderBy(asc(properties.name));

  // Step 2 — property selected, show full form
  if (selectedPropertyId) {
    const property = propertyList.find((p) => p.id === selectedPropertyId);
    if (!property) {
      return (
        <div className="max-w-2xl space-y-6">
          <BackLink fallbackHref="/marches" label="Marchés de travaux" />
          <p className="text-sm text-red-600">Bien introuvable.</p>
        </div>
      );
    }

    const propertyLots = await db
      .select({ id: lots.id, name: lots.name })
      .from(lots)
      .where(eq(lots.propertyId, property.id))
      .orderBy(asc(lots.name));

    const supplierRows = await db
      .select({
        id: suppliers.id,
        companyName: suppliers.companyName,
        firstName: suppliers.firstName,
        lastName: suppliers.lastName,
      })
      .from(suppliers)
      .where(eq(suppliers.isActive, true))
      .orderBy(asc(suppliers.companyName));

    const supplierOptions = supplierRows.map((s) => ({
      id: s.id,
      label: (s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || 'Fournisseur',
    }));

    const marcheTypeRows = await db
      .select({ id: marcheTypes.id, label: marcheTypes.label })
      .from(marcheTypes)
      .where(eq(marcheTypes.isActive, true))
      .orderBy(asc(marcheTypes.sortOrder));

    return (
      <div className="max-w-3xl space-y-6">
        <BackLink fallbackHref="/marches" label="Marchés de travaux" />

        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
            Patrimoine · Marchés
          </div>
          <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
            Nouveau marché de travaux
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            Sur le bien{' '}
            <Link href={`/biens/properties/${property.id}`} className="link-cell-soft">
              {property.name}
            </Link>
            . <Link href="/marches/new" className="text-zinc-400 hover:text-zinc-700">Changer de bien</Link>
          </p>
        </div>

        <MarcheForm
          action={createMarcheAction}
          propertyId={property.id}
          propertyName={property.name}
          lots={propertyLots}
          suppliers={supplierOptions}
          marcheTypes={marcheTypeRows}
          defaultValues={{
            lotIds: propertyLots.map((l) => l.id),
            supplierId: prefillSupplierId,
          }}
          cancelHref="/marches"
          submitLabel="Créer le marché"
          createSupplierAction={createSupplierInlineAction}
        />
      </div>
    );
  }

  // Step 1 — pick a property
  const propertyOptions = propertyList.map((p) => ({ id: p.id, label: p.name }));

  return (
    <div className="max-w-lg space-y-6">
      <BackLink fallbackHref="/marches" label="Marchés de travaux" />

      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Patrimoine · Marchés
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          Nouveau marché de travaux
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Choisis d'abord le bien sur lequel se font les travaux.
        </p>
      </div>

      <form method="get" className="card space-y-5 p-6">
        {prefillSupplierId && (
          <input type="hidden" name="supplierId" value={prefillSupplierId} />
        )}
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Bien immobilier <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <EntityCombobox
              name="propertyId"
              options={propertyOptions}
              placeholder="Rechercher un bien…"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/marches" className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Continuer →
          </button>
        </div>
      </form>
    </div>
  );
}

import { db } from '@/db/client';
import { locations, lots, properties, customers } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { updateLocationAction } from '../../actions';
import { createCustomerInlineAction } from '@/app/(dashboard)/clients/actions';
import { LocationFormFields } from '../../location-form-fields';

export const dynamic = 'force-dynamic';

export default async function EditLocationPage({ params }: { params: { id: string } }) {
  const rows = await db
    .select()
    .from(locations)
    .where(eq(locations.id, params.id))
    .limit(1);
  if (rows.length === 0) notFound();
  const loc = rows[0];

  const lotRows = await db
    .select({ id: lots.id, name: lots.name, propertyName: properties.name })
    .from(lots)
    .innerJoin(properties, eq(lots.propertyId, properties.id))
    .orderBy(asc(properties.name), asc(lots.name));

  const customerRows = await db
    .select({
      id: customers.id,
      companyName: customers.companyName,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
    })
    .from(customers)
    .where(eq(customers.isActive, true))
    .orderBy(asc(customers.companyName));

  const lotOptions = lotRows.map((l) => ({
    id: l.id,
    label: `${l.propertyName.toUpperCase()} · ${l.name}`,
  }));
  const customerOptions = customerRows.map((c) => ({
    id: c.id,
    label:
      c.companyName ||
      `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
      'client',
    hint: c.email ?? undefined,
  }));

  return (
    <div className="max-w-3xl space-y-8">
      <BackLink fallbackHref={`/locations/${loc.id}`} label="Retour à la fiche" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Modifier la location
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Édition</span>
        </h1>
      </header>

      <form action={updateLocationAction} className="card space-y-6 p-6">
        <input type="hidden" name="id" value={loc.id} />

        <LocationFormFields
          lotOptions={lotOptions}
          customerOptions={customerOptions}
          defaultLotId={loc.lotId}
          defaultCustomerId={loc.customerId}
          createCustomerAction={createCustomerInlineAction}
          defaultValues={{
            typeLocation: loc.typeLocation,
            periodicite: loc.periodicite,
            dateDebut: loc.dateDebut,
            dateFin: loc.dateFin ?? '',
            prixLocation: loc.prixLocation ?? '',
            depotGarantie: loc.depotGarantie ?? '',
            chargesCourantes: loc.chargesCourantes ?? '',
            fraisMenage: loc.fraisMenage ?? '',
            taxeSejour: loc.taxeSejour ?? '',
            notes: loc.notes ?? '',
          }}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/locations/${loc.id}`} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

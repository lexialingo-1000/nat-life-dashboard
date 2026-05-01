import { db } from '@/db/client';
import { lots, properties, customers } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { createLocationAction } from '../actions';
import { createCustomerInlineAction } from '@/app/(dashboard)/clients/actions';
import { LocationFormFields } from '../location-form-fields';

export const dynamic = 'force-dynamic';

interface SearchParams {
  lotId?: string;
  customerId?: string;
  returnTo?: string;
}

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const lotRows = await db
    .select({
      id: lots.id,
      name: lots.name,
      propertyName: properties.name,
    })
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

  const presetLotId = searchParams.lotId ?? '';
  const presetCustomerId = searchParams.customerId ?? '';
  const returnTo = searchParams.returnTo ?? '';

  const cancelHref =
    returnTo ||
    (presetLotId
      ? `/biens/lots/${presetLotId}`
      : presetCustomerId
      ? `/clients/${presetCustomerId}`
      : '/locations');

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
      <BackLink fallbackHref={cancelHref} label="Retour" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Nouvelle location
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Lier un locataire à un bien ou un lot</span>
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
          La location établit la relation locative — bail annuel meublé/nu, saisonnier direct ou
          via plateforme. Renseignez le loyer (avec sa périodicité), le dépôt de garantie et les
          charges associées.
        </p>
      </header>

      <form action={createLocationAction} className="card space-y-6 p-6">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        <LocationFormFields
          lotOptions={lotOptions}
          customerOptions={customerOptions}
          defaultLotId={presetLotId}
          defaultCustomerId={presetCustomerId}
          createCustomerAction={createCustomerInlineAction}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Link href={cancelHref} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Créer la location
          </button>
        </div>
      </form>
    </div>
  );
}

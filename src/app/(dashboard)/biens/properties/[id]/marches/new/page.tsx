import { db } from '@/db/client';
import { properties, lots, suppliers } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createMarcheAction } from '@/app/(dashboard)/marches/actions';
import { MarcheForm } from '@/components/marche-form';

export const dynamic = 'force-dynamic';

export default async function NewMarchePage({ params }: { params: { id: string } }) {
  const propertyRow = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.id, params.id))
    .limit(1);

  if (propertyRow.length === 0) notFound();
  const property = propertyRow[0];

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
    .orderBy(asc(suppliers.companyName));

  const supplierOptions = supplierRows.map((s) => ({
    id: s.id,
    label:
      s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? 'Fournisseur',
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/biens/properties/${property.id}`}
        className="inline-flex items-center text-sm text-zinc-600 hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {property.name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau marché de travaux</h1>
        <p className="mt-1 text-sm text-zinc-500">Sur le bien {property.name}.</p>
      </div>

      <MarcheForm
        action={createMarcheAction}
        propertyId={property.id}
        propertyName={property.name}
        lots={propertyLots}
        suppliers={supplierOptions}
        cancelHref={`/biens/properties/${property.id}`}
        submitLabel="Créer le marché"
      />
    </div>
  );
}

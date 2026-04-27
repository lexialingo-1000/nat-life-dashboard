import { db } from '@/db/client';
import { properties, lots, companies } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { deletePropertyAction } from '../actions';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  let property: any = null;
  let propertyLots: any[] = [];
  let dbError: string | null = null;
  try {
    const rows = await db
      .select({
        id: properties.id,
        name: properties.name,
        type: properties.type,
        address: properties.address,
        city: properties.city,
        postalCode: properties.postalCode,
        purchaseDate: properties.purchaseDate,
        purchasePrice: properties.purchasePrice,
        notaire: properties.notaire,
        cadastre: properties.cadastre,
        notes: properties.notes,
        companyName: companies.name,
        companyId: companies.id,
      })
      .from(properties)
      .innerJoin(companies, eq(properties.companyId, companies.id))
      .where(eq(properties.id, params.id))
      .limit(1);
    if (rows.length === 0) notFound();
    property = rows[0];

    propertyLots = await db
      .select()
      .from(lots)
      .where(eq(lots.propertyId, property.id))
      .orderBy(asc(lots.name));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  if (!property) {
    return (
      <div className="card p-6 text-[13px] text-amber-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  const notaire = (property.notaire as any) ?? {};

  return (
    <div className="space-y-8">
      <Link
        href="/biens"
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-amber-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Biens immobiliers
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
            <Link href={`/societes/${property.companyId}`} className="hover:text-amber-800">
              {property.companyName}
            </Link>
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif italic">{property.name}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {property.type} · {property.address ?? 'adresse à compléter'}
            {property.postalCode && property.city && ` · ${property.postalCode} ${property.city}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/biens/properties/${property.id}/edit`} className="btn-secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <DeleteButton
            action={deletePropertyAction}
            id={property.id}
            label="Supprimer"
            confirmationPhrase={property.name}
            description={`Cette action est irréversible. L'immeuble "${property.name}" et tous ses lots seront supprimés.`}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            Acquisition
          </h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Date d'achat">{formatDate(property.purchaseDate)}</Row>
            <Row label="Prix">
              <span className="tnum">
                {property.purchasePrice
                  ? `${Number(property.purchasePrice).toLocaleString('fr-FR')} €`
                  : '—'}
              </span>
            </Row>
            <Row label="Cadastre">
              <span className="font-mono text-[12px]">{property.cadastre ?? '—'}</span>
            </Row>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            Notaire
          </h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Nom">{notaire.name ?? '—'}</Row>
            <Row label="Étude">{notaire.etude ?? '—'}</Row>
            <Row label="Contact">
              {notaire.phone || notaire.email ? (
                <span>
                  {notaire.phone ?? ''}
                  {notaire.phone && notaire.email && ' · '}
                  {notaire.email ?? ''}
                </span>
              ) : (
                '—'
              )}
            </Row>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-[13px] text-zinc-700">{property.notes ?? '—'}</p>
        </div>
      </div>

      <section>
        <div className="page-header mb-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
            Patrimoine
          </div>
          <h2 className="mt-1.5 text-[20px] font-medium tracking-tight text-zinc-900">
            <span className="display-serif italic">Lots</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{propertyLots.length}</span>
          </h2>
        </div>

        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nom</th>
                <th className="w-[140px]">Type</th>
                <th className="w-[140px]">Surface Carrez</th>
                <th className="w-[120px]">Statut</th>
              </tr>
            </thead>
            <tbody>
              {propertyLots.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium text-zinc-900">
                    <Link href={`/biens/lots/${l.id}`} className="hover:text-amber-700">
                      {l.name}
                    </Link>
                  </td>
                  <td>
                    <span className="badge-neutral">{l.type}</span>
                  </td>
                  <td className="tnum text-[12px] text-zinc-600">
                    {l.surfaceCarrez ? `${l.surfaceCarrez} m²` : '—'}
                  </td>
                  <td>
                    <span
                      className={
                        l.status === 'vacant'
                          ? 'badge-neutral'
                          : l.status === 'travaux'
                          ? 'badge-amber'
                          : 'badge-emerald'
                      }
                    >
                      {l.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-700">{children}</dd>
    </div>
  );
}

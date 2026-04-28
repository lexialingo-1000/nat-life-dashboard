import { db } from '@/db/client';
import { companies, properties, lots } from '@/db/schema';
import { eq, sql, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { deleteSocieteAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function SocieteDetailPage({ params }: { params: { id: string } }) {
  let company: any = null;
  let props: any[] = [];
  let dbError: string | null = null;
  try {
    const rows = await db.select().from(companies).where(eq(companies.id, params.id)).limit(1);
    if (rows.length === 0) notFound();
    company = rows[0];

    props = await db
      .select({
        id: properties.id,
        name: properties.name,
        type: properties.type,
        address: properties.address,
        lotsCount: sql<number>`(SELECT count(*)::int FROM "lots" WHERE "lots"."property_id" = "properties"."id")`,
      })
      .from(properties)
      .where(eq(properties.companyId, company.id))
      .orderBy(asc(properties.name));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  if (!company) {
    return (
      <div className="card p-6 text-sm text-amber-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/societes" className="inline-flex items-center text-sm text-slate-600 hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Sociétés
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {company.type} ·{' '}
            <span className="uppercase">{company.formeJuridique ?? '—'}</span> · SIREN{' '}
            <span className="font-mono">{company.siren ?? '—'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/societes/${company.id}/edit`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Modifier
          </Link>
          <DeleteButton
            action={deleteSocieteAction}
            id={company.id}
            label="Supprimer la société"
            confirmationPhrase={company.name}
            description={`Cette action est irréversible. La société "${company.name}" sera supprimée. Les biens immobiliers rattachés seront orphelins (à réaffecter).`}
          />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Informations</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Activité</dt>
            <dd className="mt-1">{company.activitePrincipale ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Code NAF</dt>
            <dd className="mt-1 font-mono">{company.nafCode ?? '—'}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Adresse siège</dt>
            <dd className="mt-1">{company.address ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Biens immobiliers
            <span className="ml-2 text-xs font-normal text-slate-500">({props.length})</span>
          </h2>
        </div>
        {props.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            {company.type === 'immobiliere'
              ? 'Aucun bien rattaché à cette société.'
              : 'Société commerciale — pas de biens immobiliers.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Adresse</th>
                <th className="px-4 py-2">Lots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {props.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/biens/properties/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">{p.type}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{p.address ?? '—'}</td>
                  <td className="px-4 py-2 tabular-nums">{p.lotsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

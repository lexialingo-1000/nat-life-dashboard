import { db } from '@/db/client';
import { companies } from '@/db/schema';
import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SocietesPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    rows = await db.select().from(companies).orderBy(asc(companies.name));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
            Référentiel
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif italic">Sociétés</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
            Multi-société · entités juridiques gérées par FKA Holding.
          </p>
        </div>
        <Link href="/societes/new" className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Ajouter une société
        </Link>
      </header>

      {dbError && (
        <div className="card p-6 text-[13px] text-amber-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Forme</th>
                <th>SIREN</th>
                <th>NAF</th>
                <th className="hidden lg:table-cell">Siège</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-medium text-zinc-900">
                    <Link href={`/societes/${c.id}`} className="hover:text-amber-700">
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    <span className={c.type === 'commerciale' ? 'badge-blue' : 'badge-emerald'}>
                      {c.type === 'commerciale' ? 'Commerciale' : 'Immobilière'}
                    </span>
                  </td>
                  <td>
                    <span className="badge-neutral">
                      {c.formeJuridique ?? '—'}
                    </span>
                  </td>
                  <td className="font-mono text-[12px] text-zinc-600 tnum">{c.siren ?? '—'}</td>
                  <td className="font-mono text-[12px] text-zinc-600">{c.nafCode ?? '—'}</td>
                  <td className="hidden text-[12px] text-zinc-500 lg:table-cell">
                    {c.address?.split(',')[0] ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

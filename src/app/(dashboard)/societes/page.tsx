import { db } from '@/db/client';
import { companies } from '@/db/schema';
import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SocietesTable, type SocieteRow } from './societes-table';

export const dynamic = 'force-dynamic';

export default async function SocietesPage() {
  let rows: SocieteRow[] = [];
  let dbError: string | null = null;
  try {
    const raw = await db.select().from(companies).orderBy(asc(companies.name));
    rows = raw.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      formeJuridique: c.formeJuridique,
      siren: c.siren,
      nafCode: c.nafCode,
      address: c.address,
      isActive: (c as { isActive?: boolean }).isActive ?? true,
    }));
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
            <span className="display-serif">Sociétés</span>
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

      {!dbError && (
        <div className="card overflow-hidden">
          <SocietesTable rows={rows} />
        </div>
      )}
    </div>
  );
}

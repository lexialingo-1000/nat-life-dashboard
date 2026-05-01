import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { ClientsTable, type ClientRow } from './clients-table';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  let rows: ClientRow[] = [];
  let dbError: string | null = null;
  try {
    const raw = await db.select().from(customers).orderBy(asc(customers.companyName));
    rows = raw.map((c) => ({
      id: c.id,
      displayName:
        c.companyName ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ?? '—',
      email: c.email,
      phone: c.phone,
      address: c.address,
      isActive: c.isActive,
      tenantType: c.tenantType,
    }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Référentiel
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">Clients</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
            Table unifiée · clients FKA (B2B AMO) et locataires Valrose/KAPIMMO.
          </p>
        </div>
        <a href="/clients/new" className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Ajouter un client
        </a>
      </header>

      {dbError && (
        <div className="card p-6 text-sm text-emerald-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && (
        <div className="card overflow-hidden">
          <ClientsTable rows={rows} />
        </div>
      )}
    </div>
  );
}

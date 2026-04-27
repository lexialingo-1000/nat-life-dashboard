import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  let customer: any = null;
  let dbError: string | null = null;
  try {
    const rows = await db.select().from(customers).where(eq(customers.id, params.id)).limit(1);
    if (rows.length === 0) notFound();
    customer = rows[0];
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  if (!customer) {
    return (
      <div className="card p-6 text-sm text-amber-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  const displayName =
    customer.companyName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ?? 'Client';

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center text-sm text-slate-600 hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Clients
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {customer.email ?? '—'} · {customer.phone ?? '—'}
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Informations</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Adresse</dt>
            <dd className="mt-1">{customer.address ?? '—'}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap">{customer.notes ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Documents</h2>
        <p className="mt-2 text-sm text-slate-500">
          Documents typés (Pièce d'identité, KBis, etc.) : à brancher sur MinIO une fois les credentials fournis.
        </p>
      </div>
    </div>
  );
}

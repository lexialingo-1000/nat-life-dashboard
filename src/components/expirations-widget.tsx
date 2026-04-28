import { db } from '@/db/client';
import { sql, and, lte, isNotNull } from 'drizzle-orm';
import { supplierDocuments, documentTypes, suppliers } from '@/db/schema';
import { expirationStatus } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

const DAYS_THRESHOLD = 30;

interface ExpirationItem {
  id: string;
  parentLabel: string;
  parentLink: string;
  typeLabel: string;
  expiresAt: string;
}

async function fetchExpirations(): Promise<ExpirationItem[]> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + DAYS_THRESHOLD);
  const thresholdIso = threshold.toISOString().split('T')[0];

  const supplierExp = await db
    .select({
      id: supplierDocuments.id,
      parentLabel: sql<string>`COALESCE(${suppliers.companyName}, CONCAT(${suppliers.firstName}, ' ', ${suppliers.lastName}))`,
      parentId: suppliers.id,
      typeLabel: documentTypes.label,
      expiresAt: supplierDocuments.expiresAt,
    })
    .from(supplierDocuments)
    .innerJoin(documentTypes, sql`${supplierDocuments.typeId} = ${documentTypes.id}`)
    .innerJoin(suppliers, sql`${supplierDocuments.supplierId} = ${suppliers.id}`)
    .where(
      and(
        isNotNull(supplierDocuments.expiresAt),
        lte(supplierDocuments.expiresAt, thresholdIso)
      )
    );

  return supplierExp.map((row) => ({
    id: row.id,
    parentLabel: row.parentLabel ?? '—',
    parentLink: `/fournisseurs/${row.parentId}`,
    typeLabel: row.typeLabel,
    expiresAt: row.expiresAt!,
  }));
}

export async function ExpirationsWidget() {
  let items: ExpirationItem[] = [];
  let dbError = false;
  try {
    items = await fetchExpirations();
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="card p-6">
        <p className="text-[13px] text-emerald-700">
          Connexion DB indisponible — vérifie <span className="kbd">DATABASE_URL</span>
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card p-10">
        <div className="flex flex-col items-center text-center">
          <div className="display-serif text-[32px] text-zinc-300">RAS</div>
          <p className="mt-2 text-[13px] text-zinc-500">
            Aucun document n'expire dans les 30 prochains jours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-zinc-100">
      {items.map((item) => {
        const status = expirationStatus(item.expiresAt);
        return (
          <Link
            key={item.id}
            href={item.parentLink}
            className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-50"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-[13px] font-medium text-zinc-900">{item.parentLabel}</span>
              <span className="text-[12px] text-zinc-500">{item.typeLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={
                  status.color === 'red'
                    ? 'badge-red'
                    : status.color === 'orange'
                    ? 'badge-amber'
                    : 'badge-emerald'
                }
              >
                {status.label}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

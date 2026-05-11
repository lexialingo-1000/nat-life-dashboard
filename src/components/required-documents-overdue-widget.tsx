import { db } from '@/db/client';
import { sql } from 'drizzle-orm';
import {
  documentTypes,
  suppliers,
  supplierDocuments,
  customers,
  customerDocuments,
} from '@/db/schema';
import { ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface OverdueItem {
  key: string;
  entityLabel: string;
  entityLink: string;
  typeLabel: string;
  state: 'missing' | 'expired';
  expiresAt?: string | null;
}

/**
 * Widget transverse "Documents obligatoires manquants/expirés" pour la page
 * d'accueil. Source : V11 §18 ("Ce document est expiré et obligatoire, Je
 * devrai le voir sur ma page d'accueil").
 *
 * Scopes couverts en V1.9 PR #3 :
 * - supplier : tous fournisseurs actifs × types is_required scope=supplier
 * - customer : customers × types is_required scope=customer
 *   (filtrés par applies_to_tenant_type : LT/CT/all/null)
 *
 * Autres scopes (company/property/lot/marche/location) hors-périmètre PR #3
 * — peu de types is_required en pratique, traités plus tard si demandé.
 */
async function fetchOverdue(): Promise<OverdueItem[]> {
  const today = new Date().toISOString().split('T')[0];

  // === SUPPLIER : MISSING ===
  // suppliers actifs × types is_required scope=supplier où PAS de doc
  const supplierMissing = await db.execute<{
    supplier_id: string;
    supplier_label: string;
    type_id: string;
    type_label: string;
  }>(sql`
    SELECT s.id AS supplier_id,
           COALESCE(s.company_name, CONCAT(s.first_name, ' ', s.last_name)) AS supplier_label,
           dt.id AS type_id,
           dt.label AS type_label
    FROM ${suppliers} s
    CROSS JOIN ${documentTypes} dt
    WHERE s.is_active = true
      AND dt.is_active = true
      AND dt.is_required = true
      AND dt.scope = 'supplier'
      AND NOT EXISTS (
        SELECT 1 FROM ${supplierDocuments} sd
        WHERE sd.supplier_id = s.id AND sd.type_id = dt.id
      )
    ORDER BY supplier_label, dt.sort_order
    LIMIT 50
  `);

  // === SUPPLIER : EXPIRED ===
  const supplierExpired = await db.execute<{
    doc_id: string;
    supplier_id: string;
    supplier_label: string;
    type_label: string;
    expires_at: string;
  }>(sql`
    SELECT sd.id AS doc_id,
           s.id AS supplier_id,
           COALESCE(s.company_name, CONCAT(s.first_name, ' ', s.last_name)) AS supplier_label,
           dt.label AS type_label,
           sd.expires_at::text AS expires_at
    FROM ${supplierDocuments} sd
    INNER JOIN ${suppliers} s ON s.id = sd.supplier_id
    INNER JOIN ${documentTypes} dt ON dt.id = sd.type_id
    WHERE dt.is_required = true
      AND dt.scope = 'supplier'
      AND s.is_active = true
      AND sd.expires_at IS NOT NULL
      AND sd.expires_at < ${today}::date
    ORDER BY sd.expires_at
    LIMIT 50
  `);

  // === CUSTOMER : MISSING ===
  // Pour tenant_type=LT → types appliesTo LT ou all
  // Pour tenant_type=CT → types appliesTo CT ou all
  // Pour tenant_type=NULL (B2B) → types appliesTo NULL ou all
  const customerMissing = await db.execute<{
    customer_id: string;
    customer_label: string;
    type_id: string;
    type_label: string;
  }>(sql`
    SELECT c.id AS customer_id,
           COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) AS customer_label,
           dt.id AS type_id,
           dt.label AS type_label
    FROM ${customers} c
    CROSS JOIN ${documentTypes} dt
    WHERE c.is_active = true
      AND dt.is_active = true
      AND dt.is_required = true
      AND dt.scope = 'customer'
      AND (
        dt.applies_to_tenant_type = 'all'
        OR (dt.applies_to_tenant_type IS NULL AND c.tenant_type IS NULL)
        OR (dt.applies_to_tenant_type = c.tenant_type)
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${customerDocuments} cd
        WHERE cd.customer_id = c.id AND cd.type_id = dt.id
      )
    ORDER BY customer_label, dt.sort_order
    LIMIT 50
  `);

  // === CUSTOMER : EXPIRED ===
  const customerExpired = await db.execute<{
    doc_id: string;
    customer_id: string;
    customer_label: string;
    type_label: string;
    expires_at: string;
  }>(sql`
    SELECT cd.id AS doc_id,
           c.id AS customer_id,
           COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) AS customer_label,
           dt.label AS type_label,
           cd.expires_at::text AS expires_at
    FROM ${customerDocuments} cd
    INNER JOIN ${customers} c ON c.id = cd.customer_id
    INNER JOIN ${documentTypes} dt ON dt.id = cd.type_id
    WHERE dt.is_required = true
      AND dt.scope = 'customer'
      AND c.is_active = true
      AND cd.expires_at IS NOT NULL
      AND cd.expires_at < ${today}::date
    ORDER BY cd.expires_at
    LIMIT 50
  `);

  const items: OverdueItem[] = [];

  for (const row of supplierMissing) {
    items.push({
      key: `sup-miss-${row.supplier_id}-${row.type_id}`,
      entityLabel: row.supplier_label,
      entityLink: `/fournisseurs/${row.supplier_id}`,
      typeLabel: row.type_label,
      state: 'missing',
    });
  }
  for (const row of supplierExpired) {
    items.push({
      key: `sup-exp-${row.doc_id}`,
      entityLabel: row.supplier_label,
      entityLink: `/fournisseurs/${row.supplier_id}`,
      typeLabel: row.type_label,
      state: 'expired',
      expiresAt: row.expires_at,
    });
  }
  for (const row of customerMissing) {
    items.push({
      key: `cus-miss-${row.customer_id}-${row.type_id}`,
      entityLabel: row.customer_label,
      entityLink: `/clients/${row.customer_id}`,
      typeLabel: row.type_label,
      state: 'missing',
    });
  }
  for (const row of customerExpired) {
    items.push({
      key: `cus-exp-${row.doc_id}`,
      entityLabel: row.customer_label,
      entityLink: `/clients/${row.customer_id}`,
      typeLabel: row.type_label,
      state: 'expired',
      expiresAt: row.expires_at,
    });
  }

  return items;
}

function daysSince(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export async function RequiredDocumentsOverdueWidget() {
  let items: OverdueItem[] = [];
  let dbError = false;
  try {
    items = await fetchOverdue();
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="card p-6">
        <p className="text-[13px] text-blue-700">
          Connexion DB indisponible.
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
            Tous les documents obligatoires sont à jour.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-zinc-100">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.entityLink}
          className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-50"
        >
          <div className="flex items-baseline gap-3">
            <AlertCircle
              className={`h-3.5 w-3.5 shrink-0 ${
                item.state === 'expired' ? 'text-red-600' : 'text-amber-600'
              }`}
              strokeWidth={2}
            />
            <span className="text-[13px] font-medium text-zinc-900">{item.entityLabel}</span>
            <span className="text-[12px] text-zinc-500">{item.typeLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            {item.state === 'expired' && item.expiresAt ? (
              <span className="badge-red">
                Expiré depuis {daysSince(item.expiresAt)}j
              </span>
            ) : (
              <span className="badge-amber">Manquant</span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
          </div>
        </Link>
      ))}
    </div>
  );
}

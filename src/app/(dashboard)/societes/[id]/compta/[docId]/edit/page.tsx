import { db } from '@/db/client';
import {
  companyAccountingDocuments,
  companies,
  suppliers,
  marchesTravaux,
  properties,
} from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { updateAccountingDocAction } from '@/app/(dashboard)/societes/accounting-actions';

export const dynamic = 'force-dynamic';

const KIND_OPTIONS = [
  { value: 'devis', label: 'Devis' },
  { value: 'commande', label: 'Commande' },
  { value: 'facture', label: 'Facture' },
];

// V12bis umbrella §2 — modifier un devis/commande/facture (retours Natacha dashboard-13).
export default async function EditAccountingDocPage({
  params,
}: {
  params: { id: string; docId: string };
}) {
  const rows = await db
    .select()
    .from(companyAccountingDocuments)
    .where(
      and(
        eq(companyAccountingDocuments.id, params.docId),
        eq(companyAccountingDocuments.companyId, params.id)
      )
    )
    .limit(1);
  if (rows.length === 0) notFound();
  const d = rows[0];

  const companyRow = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, params.id))
    .limit(1);
  const companyName = companyRow[0]?.name ?? 'Société';

  // Fournisseurs actifs
  const supplierList = await db
    .select({
      id: suppliers.id,
      companyName: suppliers.companyName,
      firstName: suppliers.firstName,
      lastName: suppliers.lastName,
    })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.companyName), asc(suppliers.lastName));

  // Marchés (toutes sociétés — pattern cohérent avec V12bis PR9 §2)
  const marcheList = await db
    .select({
      id: marchesTravaux.id,
      name: marchesTravaux.name,
      propertyName: properties.name,
    })
    .from(marchesTravaux)
    .innerJoin(properties, eq(marchesTravaux.propertyId, properties.id))
    .orderBy(asc(marchesTravaux.name));

  const returnTo = `/societes/${params.id}?tab=compta`;

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref={returnTo} label={companyName} />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Compta · Modifier
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier</span>{' '}
          <span className="text-zinc-900">{d.name}</span>
        </h1>
      </header>

      <form action={updateAccountingDocAction} className="card space-y-5 p-6" autoComplete="off">
        <input type="hidden" name="id" value={d.id} />
        <input type="hidden" name="companyId" value={d.companyId} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Type *</label>
            <select name="kind" defaultValue={d.kind} required className="input mt-1">
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Date document</label>
            <input
              type="date"
              name="documentDate"
              defaultValue={d.documentDate ?? ''}
              className="input mt-1"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Nom *</label>
          <input
            name="name"
            defaultValue={d.name}
            required
            className="input mt-1"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Fournisseur *</label>
            <select name="supplierId" defaultValue={d.supplierId} required className="input mt-1">
              {supplierList.map((s) => {
                const label =
                  s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? '—';
                return (
                  <option key={s.id} value={s.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Marché (optionnel)</label>
            <select name="marcheId" defaultValue={d.marcheId ?? ''} className="input mt-1">
              <option value="">— Aucun marché —</option>
              {marcheList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.propertyName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Montant HT (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="amountHt"
              defaultValue={d.amountHt ?? ''}
              className="input tnum mt-1"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Montant TTC (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="amountTtc"
              defaultValue={d.amountTtc ?? ''}
              className="input tnum mt-1"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={d.notes ?? ''}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-500">
          La pièce jointe MinIO n&apos;est pas modifiable depuis ce formulaire. Pour la remplacer,
          supprime le document et ré-uploade-le depuis l&apos;onglet Compta.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={returnTo} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

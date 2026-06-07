import { FournisseurCreateForm } from '@/components/fournisseur-create-form';
import { createSupplierAction } from '../actions';
import { BackLink } from '@/components/back-link';
import { db } from '@/db/client';
import { supplierTypes } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function NewFournisseurPage() {
  // V12bis PR9 §3 — types paramétrables (admin /admin/supplier-types).
  const typeOptions = await db
    .select({ id: supplierTypes.id, code: supplierTypes.code, label: supplierTypes.label })
    .from(supplierTypes)
    .where(eq(supplierTypes.isActive, true))
    .orderBy(asc(supplierTypes.sortOrder), asc(supplierTypes.label));

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref="/fournisseurs" label="Fournisseurs" />

      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Référentiel
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          Ajouter un fournisseur
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Informations générales + contacts optionnels. Documents (RC, décennale, KBis…) à ajouter
          depuis la fiche.
        </p>
      </div>

      <FournisseurCreateForm action={createSupplierAction} typeOptions={typeOptions} />
    </div>
  );
}

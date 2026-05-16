import { db } from '@/db/client';
import { supplierTypes } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { BackLink } from '@/components/back-link';
import { SupplierTypeCreateForm } from './supplier-type-create-form';
import { SupplierTypesSortableList } from './supplier-types-sortable-list';

export const dynamic = 'force-dynamic';

export default async function SupplierTypesPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    rows = await db
      .select()
      .from(supplierTypes)
      .orderBy(asc(supplierTypes.sortOrder), asc(supplierTypes.label));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/admin/parametres" label="Paramètres" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Administration · Paramètres
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Types de fournisseurs</span>
          <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-zinc-500">
          Catalogue extensible des catégories de fournisseurs (Notaire, Banque, Entrepreneur, etc.).
          Utilisé sur la fiche fournisseur et pour conditionner les documents obligatoires par
          catégorie. Glisser-déposer pour réordonner.
        </p>
      </header>

      {dbError && (
        <div className="card p-6 text-[13px] text-blue-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-8" />
                <th>Libellé</th>
                <th className="w-[200px]">Code</th>
                <th className="w-[110px]">Statut</th>
                <th className="w-[180px] pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <SupplierTypesSortableList rows={rows} />
          </table>
        </div>
      )}

      <section>
        <div className="page-header mb-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
            Catalogue
          </div>
          <h2 className="mt-1.5 text-[20px] font-medium tracking-tight text-zinc-900">
            <span className="display-serif">Ajouter</span> un nouveau type
          </h2>
        </div>

        <SupplierTypeCreateForm />
      </section>
    </div>
  );
}

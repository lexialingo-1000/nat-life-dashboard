import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheLotAffectations,
  marcheTypes,
  lots,
  properties,
  companies,
  suppliers,
} from '@/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MarchesTable, type MarcheRow } from './marches-table';
import { deleteMarcheAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function MarchesPage({
  searchParams,
}: {
  searchParams: { supplierId?: string; showInactive?: string };
}) {
  const activeSupplierId = searchParams.supplierId ?? undefined;
  // V1.11 R5 — par défaut, n'affiche que les marchés ACTIFS. Toggle URL
  // ?showInactive=true pour les voir aussi.
  const showInactive = searchParams.showInactive === 'true';

  let rows: MarcheRow[] = [];
  let supplierList: { id: string; label: string }[] = [];
  let inactiveCount = 0;
  let dbError: string | null = null;
  try {
    const rawSuppliers = await db
      .select({
        id: suppliers.id,
        companyName: suppliers.companyName,
        firstName: suppliers.firstName,
        lastName: suppliers.lastName,
      })
      .from(suppliers)
      .orderBy(asc(suppliers.companyName));
    supplierList = rawSuppliers.map((s) => ({
      id: s.id,
      label: s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
    }));

    // V1.11 R5 — compte les inactifs pour afficher le toggle "Afficher inactifs (N)".
    const inactiveCountRows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(marchesTravaux)
      .where(eq(marchesTravaux.isActive, false));
    inactiveCount = inactiveCountRows[0]?.n ?? 0;

    const conditions = [];
    if (!showInactive) conditions.push(eq(marchesTravaux.isActive, true));
    if (activeSupplierId) conditions.push(eq(marchesTravaux.supplierId, activeSupplierId));

    const base = db
      .select({
        id: marchesTravaux.id,
        name: marchesTravaux.name,
        // V1.11 R7 — description exposée pour la 2ᵉ colonne de la liste.
        description: marchesTravaux.description,
        amountHt: marchesTravaux.amountHt,
        status: marchesTravaux.status,
        isActive: marchesTravaux.isActive,
        supplierId: suppliers.id,
        supplierCompanyName: suppliers.companyName,
        supplierFirstName: suppliers.firstName,
        supplierLastName: suppliers.lastName,
        propertyId: properties.id,
        propertyName: properties.name,
        companyName: companies.name,
        marcheTypeLabel: marcheTypes.label,
        lotsConcernes: sql<string | null>`(
          SELECT string_agg(${lots.name}, ', ' ORDER BY ${lots.name})
          FROM ${marcheLotAffectations}
          INNER JOIN ${lots} ON ${lots.id} = ${marcheLotAffectations.lotId}
          WHERE ${marcheLotAffectations.marcheId} = ${marchesTravaux.id}
        )`,
      })
      .from(marchesTravaux)
      .innerJoin(properties, eq(marchesTravaux.propertyId, properties.id))
      .innerJoin(companies, eq(properties.companyId, companies.id))
      .innerJoin(suppliers, eq(marchesTravaux.supplierId, suppliers.id))
      .leftJoin(marcheTypes, eq(marchesTravaux.marcheTypeId, marcheTypes.id));

    const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
    const rawRows = await filtered.orderBy(asc(marchesTravaux.name));
    rows = rawRows.map((r) => ({
      id: r.id,
      supplierId: r.supplierId,
      supplierLabel:
        r.supplierCompanyName ??
        `${r.supplierFirstName ?? ''} ${r.supplierLastName ?? ''}`.trim() ??
        '—',
      marcheTypeLabel: r.marcheTypeLabel,
      companyName: r.companyName,
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      lotsConcernes: r.lotsConcernes,
      description: r.description,
      amountHt: r.amountHt,
      status: r.status,
      isActive: r.isActive,
    }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  // Préserve les autres searchParams quand on toggle le filtre actif/inactif.
  const toggleHref = (() => {
    const params = new URLSearchParams();
    if (activeSupplierId) params.set('supplierId', activeSupplierId);
    if (!showInactive) params.set('showInactive', 'true');
    const qs = params.toString();
    return qs ? `/marches?${qs}` : '/marches';
  })();

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
            Patrimoine
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">Marchés de travaux</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
            Vue transversale des contrats fournisseur ↔ bien (et lots concernés).
          </p>
        </div>
        <Link href="/marches/new" className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouveau marché
        </Link>
      </header>

      {!dbError && supplierList.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <form method="get" className="flex items-center gap-3">
            <label className="text-[12px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Fournisseur
            </label>
            <select
              name="supplierId"
              defaultValue={activeSupplierId ?? ''}
              className="input w-56 text-[13px]"
            >
              <option value="">Tous les fournisseurs</option>
              {supplierList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {showInactive && <input type="hidden" name="showInactive" value="true" />}
            <button type="submit" className="btn-secondary text-[12px]">
              Filtrer
            </button>
            {(activeSupplierId || showInactive) && (
              <Link href="/marches" className="text-[12px] text-zinc-400 hover:text-zinc-700">
                Réinitialiser
              </Link>
            )}
          </form>

          {/* V1.11 R5 — toggle "Afficher inactifs (N)". Caché si 0 inactif. */}
          {inactiveCount > 0 && (
            <Link
              href={toggleHref}
              className={`ml-auto inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium transition ${
                showInactive
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {showInactive ? 'Masquer les inactifs' : `Afficher les inactifs (${inactiveCount})`}
            </Link>
          )}
        </div>
      )}

      {dbError && (
        <div className="card p-6 text-sm text-blue-700">Connexion DB indisponible : {dbError}</div>
      )}

      {!dbError && rows.length === 0 && (
        <div className="card p-12 text-center text-sm text-zinc-500">
          Aucun marché pour l'instant. La création de marchés se fait depuis la fiche d'un{' '}
          <Link href="/biens" className="text-blue-600 hover:underline">
            bien
          </Link>
          .
        </div>
      )}

      {!dbError && rows.length > 0 && (
        <MarchesTable rows={rows} deleteAction={deleteMarcheAction} />
      )}
    </div>
  );
}

import { db } from '@/db/client';
import {
  companyAccountingDocuments,
  companies,
  suppliers,
  marchesTravaux,
  marcheLotAffectations,
  lots,
  properties,
} from '@/db/schema';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { slugify } from '@/lib/storage/minio';
import { ComptaEditForm, type MarcheOpt, type ParentDocOpt } from './compta-edit-form';

export const dynamic = 'force-dynamic';

type Kind = 'devis' | 'commande' | 'facture';

const KIND_LABEL: Record<Kind, string> = {
  devis: 'Devis',
  commande: 'Commande',
  facture: 'Facture',
};

// V1.10 §3 — construit label marché avec description + lots affectés si dispo.
// Format : "{propertyName} {lotsLabel}: {description}" sinon "{name} — {propertyName}".
function buildMarcheLabel(
  name: string,
  propertyName: string,
  description: string | null,
  lotNames: string[]
): string {
  if (description && description.trim().length > 0) {
    const lotsLabel = lotNames.length > 0 ? ` ${lotNames.join(', ')}` : '';
    return `${propertyName}${lotsLabel}: ${description}`;
  }
  return `${name} — ${propertyName}`;
}

// V12bis umbrella §2 + V1.10 retours dashboard-14 (replace PJ, filtre marché live, dropdowns parents)
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
  const company = companyRow[0];
  if (!company) notFound();
  const companyName = company.name;
  const companySlug = slugify(companyName);

  // Fournisseurs actifs
  const supplierRows = await db
    .select({
      id: suppliers.id,
      companyName: suppliers.companyName,
      firstName: suppliers.firstName,
      lastName: suppliers.lastName,
    })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.companyName), asc(suppliers.lastName));
  const supplierList = supplierRows.map((s) => ({
    id: s.id,
    label:
      (s.companyName ??
        `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || 'Fournisseur',
  }));

  // V1.10 §3 — Marchés enrichis (description + property + lots affectés)
  const marcheRows = await db
    .select({
      id: marchesTravaux.id,
      name: marchesTravaux.name,
      description: marchesTravaux.description,
      supplierId: marchesTravaux.supplierId,
      propertyName: properties.name,
    })
    .from(marchesTravaux)
    .innerJoin(properties, eq(marchesTravaux.propertyId, properties.id))
    .orderBy(asc(marchesTravaux.name));

  // Lots affectés par marché (1 query agrégée)
  const marcheIds = marcheRows.map((m) => m.id);
  const lotAffectations =
    marcheIds.length > 0
      ? await db
          .select({
            marcheId: marcheLotAffectations.marcheId,
            lotName: lots.name,
          })
          .from(marcheLotAffectations)
          .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
          .where(inArray(marcheLotAffectations.marcheId, marcheIds))
          .orderBy(asc(lots.name))
      : [];
  const lotsByMarche = new Map<string, string[]>();
  for (const a of lotAffectations) {
    const list = lotsByMarche.get(a.marcheId) ?? [];
    list.push(a.lotName);
    lotsByMarche.set(a.marcheId, list);
  }
  const marcheList: MarcheOpt[] = marcheRows.map((m) => ({
    id: m.id,
    label: buildMarcheLabel(
      m.name,
      m.propertyName,
      m.description,
      lotsByMarche.get(m.id) ?? []
    ),
    supplierId: m.supplierId,
  }));

  // V1.10 §4 §5 — devis / commandes de la même société (hors doc courant)
  const parentDocs = await db
    .select({
      id: companyAccountingDocuments.id,
      kind: companyAccountingDocuments.kind,
      name: companyAccountingDocuments.name,
      documentDate: companyAccountingDocuments.documentDate,
      supplierId: companyAccountingDocuments.supplierId,
      marcheId: companyAccountingDocuments.marcheId,
    })
    .from(companyAccountingDocuments)
    .where(
      and(
        eq(companyAccountingDocuments.companyId, params.id),
        ne(companyAccountingDocuments.id, params.docId)
      )
    );

  const formatParent = (p: { kind: Kind | string; name: string; documentDate: string | null }) =>
    `${KIND_LABEL[p.kind as Kind] ?? p.kind} · ${p.name}${
      p.documentDate ? ` · ${p.documentDate}` : ''
    }`;

  const devisOptions: ParentDocOpt[] = parentDocs
    .filter((p) => p.kind === 'devis')
    .map((p) => ({
      id: p.id,
      label: formatParent(p),
      supplierId: p.supplierId,
      marcheId: p.marcheId,
    }));
  const commandeOptions: ParentDocOpt[] = parentDocs
    .filter((p) => p.kind === 'commande')
    .map((p) => ({
      id: p.id,
      label: formatParent(p),
      supplierId: p.supplierId,
      marcheId: p.marcheId,
    }));

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

      <ComptaEditForm
        doc={{
          id: d.id,
          companyId: d.companyId,
          companySlug,
          supplierId: d.supplierId,
          marcheId: d.marcheId,
          kind: d.kind as Kind,
          name: d.name,
          storageKey: d.storageKey,
          originalFilename: d.originalFilename,
          documentDate: d.documentDate,
          amountHt: d.amountHt,
          amountTtc: d.amountTtc,
          parentDevisId: d.parentDevisId,
          parentCommandeId: d.parentCommandeId,
          notes: d.notes,
        }}
        suppliers={supplierList}
        marches={marcheList}
        devisOptions={devisOptions}
        commandeOptions={commandeOptions}
        returnTo={returnTo}
      />
    </div>
  );
}

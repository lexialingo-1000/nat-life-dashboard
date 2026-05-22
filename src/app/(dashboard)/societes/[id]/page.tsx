import { db } from '@/db/client';
import {
  companies,
  properties,
  lots,
  companyDocuments,
  documentTypes,
  companyAccountingDocuments,
  suppliers,
  marchesTravaux,
  marcheLotAffectations,
} from '@/db/schema';
import { eq, sql, asc, and, desc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { SectionTitle } from '@/components/section-title';
import { DeleteButton } from '@/components/delete-button';
import {
  deleteSocieteAction,
  uploadCompanyDocumentAction,
  deleteCompanyDocumentAction,
  getCompanyDocumentUrlAction,
} from '../actions';
import { Tabs, type TabItem } from '@/components/tabs';
import { DocumentsManager } from '@/components/documents-manager';
import { loadDocumentCategoriesMap } from '@/lib/db/document-categories';
import {
  AccountingDocumentsManager,
  type AccountingDocKind,
  type AccountingRow,
} from '@/components/accounting-documents-manager';
import {
  uploadAccountingDocAction,
  deleteAccountingDocAction,
  getAccountingDocUrlAction,
} from '../accounting-actions';
import { createSupplierInlineAction } from '../../fournisseurs/actions';
import { createMarcheInlineAction } from '../../marches/actions';
import { slugify } from '@/lib/storage/minio';

export const dynamic = 'force-dynamic';

export default async function SocieteDetailPage({ params }: { params: { id: string } }) {
  let company: any = null;
  let props: any[] = [];
  let totalLots = 0;
  let dbError: string | null = null;
  try {
    const rows = await db.select().from(companies).where(eq(companies.id, params.id)).limit(1);
    if (rows.length === 0) notFound();
    company = rows[0];

    props = await db
      .select({
        id: properties.id,
        name: properties.name,
        type: properties.type,
        address: properties.address,
        lotsCount: sql<number>`(SELECT count(*)::int FROM "lots" WHERE "lots"."property_id" = "properties"."id")`,
      })
      .from(properties)
      .where(eq(properties.companyId, company.id))
      .orderBy(asc(properties.name));

    if (company.id) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(lots)
        .innerJoin(properties, eq(lots.propertyId, properties.id))
        .where(eq(properties.companyId, company.id));
      totalLots = n ?? 0;
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  if (!company) {
    return (
      <div className="card p-6 text-sm text-blue-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  const docs = await db
    .select({
      id: companyDocuments.id,
      name: companyDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: companyDocuments.storageKey,
      expiresAt: companyDocuments.expiresAt,
      documentDate: companyDocuments.documentDate,
      uploadedAt: companyDocuments.uploadedAt,
      // V1.12 R2 — catégorie héritée du type (col legacy `category` retirée).
      category: documentTypes.category,
    })
    .from(companyDocuments)
    .innerJoin(documentTypes, eq(companyDocuments.typeId, documentTypes.id))
    .where(eq(companyDocuments.companyId, company.id))
    .orderBy(asc(documentTypes.sortOrder));

  const companyDocTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'company'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const isActive = company.isActive ?? true;

  const overviewTab = (
    <div className="grid gap-4 md:grid-cols-3">
      <Kpi label="Biens immobiliers" value={props.length} />
      <Kpi label="Lots (total)" value={totalLots} />
      <Kpi
        label="État"
        value={isActive ? 'Active' : 'Inactive'}
        variant={isActive ? 'good' : 'warn'}
      />
    </div>
  );

  const identityTab = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <SectionTitle>Identité juridique</SectionTitle>
        <dl className="space-y-2 text-[13px]">
          <Row label="Nom">{company.name}</Row>
          <Row label="Type">
            <span className={company.type === 'commerciale' ? 'badge-blue' : 'badge-amber'}>
              {company.type === 'commerciale' ? 'Commerciale' : 'Immobilière'}
            </span>
          </Row>
          <Row label="Forme juridique">
            <span className="badge-neutral">{company.formeJuridique ?? '—'}</span>
          </Row>
          <Row label="SIREN">
            <span className="font-mono tnum">{company.siren ?? '—'}</span>
          </Row>
          <Row label="N° TVA intracom">
            <span className="font-mono tnum">{(company as any).tvaIntracom ?? '—'}</span>
          </Row>
          {/* V1.11 R8 — affichage fréquence TVA. */}
          <Row label="TVA">
            {(() => {
              const f = (company as { tvaFrequency?: string | null }).tvaFrequency ?? null;
              if (f === 'mensuelle') return 'TVA mensuelle';
              if (f === 'trimestrielle') return 'TVA trimestrielle';
              if (f === 'annuelle') return 'TVA annuelle';
              if (f === 'non_assujettie')
                return <span className="text-zinc-500">Non assujettie</span>;
              return <span className="text-zinc-400">—</span>;
            })()}
          </Row>
        </dl>
      </div>
      <div className="card p-5">
        <SectionTitle>Activité &amp; siège</SectionTitle>
        <dl className="space-y-2 text-[13px]">
          <Row label="Activité principale">{company.activitePrincipale ?? '—'}</Row>
          <Row label="Code NAF">
            <span className="font-mono">{company.nafCode ?? '—'}</span>
          </Row>
          <Row label="Adresse siège">{company.address ?? '—'}</Row>
        </dl>
      </div>
    </div>
  );

  const biensTab = (
    <div className="card overflow-hidden">
      {props.length === 0 ? (
        <p className="p-6 text-center text-sm text-zinc-500">
          {company.type === 'immobiliere'
            ? 'Aucun bien rattaché à cette société.'
            : 'Société commerciale — pas de biens immobiliers.'}
        </p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="w-[120px]">Type</th>
              <th>Adresse</th>
              <th className="w-[80px]">Lots</th>
            </tr>
          </thead>
          <tbody>
            {props.map((p, i) => (
              <tr key={p.id} className={i % 2 === 1 ? 'bg-zinc-50/40' : undefined}>
                <td>
                  <Link href={`/biens/properties/${p.id}`} className="link-cell">
                    {p.name}
                  </Link>
                </td>
                <td>
                  <span className="badge-neutral">{p.type}</span>
                </td>
                <td className="text-[12px] text-zinc-500">{p.address ?? '—'}</td>
                <td className="tabular-nums">{p.lotsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // V1.13 R1 — labels catégories dynamiques (renames admin propagés).
  const docCategoriesMap = await loadDocumentCategoriesMap();

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="companies"
        parentId={company.id}
        parentSlug={slugify(company.name)}
        parentIdFieldName="companyId"
        documents={docs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
          uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
          category: d.category,
        }))}
        availableTypes={companyDocTypes}
        uploadAction={uploadCompanyDocumentAction}
        deleteAction={deleteCompanyDocumentAction}
        getUrlAction={getCompanyDocumentUrlAction}
        categoriesMap={docCategoriesMap}
      />
    </div>
  );

  // V1.9 PR #4 — Onglet Compta (devis/commande/facture). Stockage doc seul,
  // pas de logique métier (V1.5 post-réforme PA).
  // V1.10 — +originalFilename, +parentDevisId/CommandeId pour relations inter-docs.
  const accountingDocs = await db
    .select({
      id: companyAccountingDocuments.id,
      kind: companyAccountingDocuments.kind,
      name: companyAccountingDocuments.name,
      originalFilename: companyAccountingDocuments.originalFilename,
      storageKey: companyAccountingDocuments.storageKey,
      documentDate: companyAccountingDocuments.documentDate,
      amountHt: companyAccountingDocuments.amountHt,
      amountTtc: companyAccountingDocuments.amountTtc,
      uploadedAt: companyAccountingDocuments.uploadedAt,
      supplierId: companyAccountingDocuments.supplierId,
      supplierCompanyName: suppliers.companyName,
      supplierFirstName: suppliers.firstName,
      supplierLastName: suppliers.lastName,
      marcheId: companyAccountingDocuments.marcheId,
      marcheName: marchesTravaux.name,
      marcheDescription: marchesTravaux.description,
      parentDevisId: companyAccountingDocuments.parentDevisId,
      parentCommandeId: companyAccountingDocuments.parentCommandeId,
    })
    .from(companyAccountingDocuments)
    .innerJoin(suppliers, eq(companyAccountingDocuments.supplierId, suppliers.id))
    .leftJoin(marchesTravaux, eq(companyAccountingDocuments.marcheId, marchesTravaux.id))
    .where(eq(companyAccountingDocuments.companyId, company.id))
    .orderBy(desc(companyAccountingDocuments.documentDate));

  // V1.10 §4 §5 — résolution labels des parents (devis et commandes liés).
  const parentIds = new Set<string>();
  for (const d of accountingDocs) {
    if (d.parentDevisId) parentIds.add(d.parentDevisId);
    if (d.parentCommandeId) parentIds.add(d.parentCommandeId);
  }
  const parentRows =
    parentIds.size > 0
      ? await db
          .select({
            id: companyAccountingDocuments.id,
            kind: companyAccountingDocuments.kind,
            name: companyAccountingDocuments.name,
            documentDate: companyAccountingDocuments.documentDate,
          })
          .from(companyAccountingDocuments)
          .where(inArray(companyAccountingDocuments.id, Array.from(parentIds)))
      : [];
  const parentById = new Map(parentRows.map((p) => [p.id, p]));
  const formatParentLabel = (id: string | null): string | null => {
    if (!id) return null;
    const p = parentById.get(id);
    if (!p) return null;
    const kindLabel = p.kind === 'devis' ? 'Devis' : p.kind === 'commande' ? 'Commande' : 'Facture';
    return `${kindLabel} ${p.name}${p.documentDate ? ` (${p.documentDate})` : ''}`;
  };

  const accountingRows: AccountingRow[] = accountingDocs.map((d) => ({
    id: d.id,
    kind: d.kind as AccountingDocKind,
    name: d.name,
    originalFilename: d.originalFilename ?? null,
    storageKey: d.storageKey,
    documentDate: d.documentDate,
    amountHt: d.amountHt,
    amountTtc: d.amountTtc,
    uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
    companyId: company.id,
    companyName: company.name,
    supplierId: d.supplierId,
    supplierLabel:
      d.supplierCompanyName ?? `${d.supplierFirstName ?? ''} ${d.supplierLastName ?? ''}`.trim() ?? 'Fournisseur',
    marcheId: d.marcheId ?? null,
    marcheLabel: d.marcheName ?? null,
    parentDevisLabel: formatParentLabel(d.parentDevisId),
    parentCommandeLabel: formatParentLabel(d.parentCommandeId),
  }));

  const accountingTotalHt = accountingRows.reduce(
    (acc, r) => acc + (r.amountHt ? Number(r.amountHt) : 0),
    0
  );
  const accountingTotalTtc = accountingRows.reduce(
    (acc, r) => acc + (r.amountTtc ? Number(r.amountTtc) : 0),
    0
  );

  // V1.10 §4 §5 — devis et commandes existants (pour dropdowns parents du form upload)
  const devisOpts = accountingRows
    .filter((r) => r.kind === 'devis')
    .map((r) => ({
      id: r.id,
      label: `${r.name}${r.documentDate ? ` (${r.documentDate})` : ''}`,
      supplierId: r.supplierId,
      marcheId: r.marcheId,
      companyId: r.companyId,
    }));
  const commandeOpts = accountingRows
    .filter((r) => r.kind === 'commande')
    .map((r) => ({
      id: r.id,
      label: `${r.name}${r.documentDate ? ` (${r.documentDate})` : ''}`,
      supplierId: r.supplierId,
      marcheId: r.marcheId,
      companyId: r.companyId,
    }));

  // Fournisseurs actifs + marchés liés à cette société (via property→company)
  const supplierOptions = await db
    .select({
      id: suppliers.id,
      companyName: suppliers.companyName,
      firstName: suppliers.firstName,
      lastName: suppliers.lastName,
    })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.companyName));

  const supplierOpts = supplierOptions.map((s) => ({
    id: s.id,
    label: (s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || 'Fournisseur',
  }));

  // V1.9 fix : on charge TOUS les marchés (toutes sociétés). Le filtrage par
  // fournisseur est fait côté client dans <AccountingDocumentsManager>. Permet
  // de saisir une facture FKA pour un marché exécuté sur VALROSE (flux
  // inter-société courant).
  // V1.10 §3 — +description + lots affectés pour label enrichi.
  const marcheOptions = await db
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

  const marcheIdsAll = marcheOptions.map((m) => m.id);
  const marcheLotRows =
    marcheIdsAll.length > 0
      ? await db
          .select({ marcheId: marcheLotAffectations.marcheId, lotName: lots.name })
          .from(marcheLotAffectations)
          .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
          .where(inArray(marcheLotAffectations.marcheId, marcheIdsAll))
          .orderBy(asc(lots.name))
      : [];
  const lotsByMarche = new Map<string, string[]>();
  for (const a of marcheLotRows) {
    const list = lotsByMarche.get(a.marcheId) ?? [];
    list.push(a.lotName);
    lotsByMarche.set(a.marcheId, list);
  }

  const marcheOpts = marcheOptions.map((m) => {
    const lotsLabel = (lotsByMarche.get(m.id) ?? []).join(', ');
    const label =
      m.description && m.description.trim().length > 0
        ? `${m.propertyName}${lotsLabel ? ` ${lotsLabel}` : ''}: ${m.description}`
        : `${m.name} — ${m.propertyName}`;
    return { id: m.id, label, supplierId: m.supplierId };
  });

  // V1.10 — companies list pour le composant unifié (toutes sociétés actives,
  // utilisé pour le dropdown filtre + scope=marche/supplier qui peuvent
  // référencer une autre société émettrice).
  const companyOptionsAll = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));
  const companyOpts = companyOptionsAll.map((c) => ({
    id: c.id,
    label: c.name,
    slug: slugify(c.name),
  }));

  // V12bis umbrella §2 — properties de cette société pour création marché à la volée.
  const propertyOptions = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.companyId, company.id))
    .orderBy(asc(properties.name));
  const propertyOpts = propertyOptions.map((p) => ({ id: p.id, label: p.name }));

  const comptaTab = (
    <div className="card p-6">
      <AccountingDocumentsManager
        scope="company"
        parentId={company.id}
        parentLabel={company.name}
        parentSlug={slugify(company.name)}
        rows={accountingRows}
        totalHt={accountingTotalHt}
        totalTtc={accountingTotalTtc}
        companies={companyOpts}
        suppliers={supplierOpts}
        marches={marcheOpts}
        createSupplierAction={createSupplierInlineAction}
        createMarcheAction={createMarcheInlineAction}
        properties={propertyOpts}
        devisOptions={devisOpts}
        commandeOptions={commandeOpts}
        uploadAction={uploadAccountingDocAction}
        deleteAction={deleteAccountingDocAction}
        getUrlAction={getAccountingDocUrlAction}
      />
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    { id: 'biens', label: 'Biens', count: props.length, content: biensTab },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
    { id: 'compta', label: 'Compta', count: accountingRows.length, content: comptaTab },
  ];

  return (
    <div className={`space-y-8 ${isActive ? '' : 'opacity-75'}`}>
      <BackLink fallbackHref="/societes" label="Sociétés" />

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
            Société {!isActive && <span className="ml-2 badge-neutral">Inactive</span>}
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{company.name}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {company.type} · <span className="uppercase">{company.formeJuridique ?? '—'}</span> ·
            SIREN <span className="font-mono">{company.siren ?? '—'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/societes/${company.id}/edit`} className="btn-secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <DeleteButton
            action={deleteSocieteAction}
            id={company.id}
            label="Supprimer"
            confirmationPhrase={company.name}
            description={`Cette action est irréversible. La société "${company.name}" sera supprimée. Les biens immobiliers rattachés seront orphelins (à réaffecter).`}
          />
        </div>
      </header>

      <Tabs tabs={tabs} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-700">{children}</dd>
    </div>
  );
}

function Kpi({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number | string;
  variant?: 'default' | 'good' | 'warn';
}) {
  return (
    <div className="card p-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-medium tabular-nums ${
          variant === 'good'
            ? 'text-blue-700'
            : variant === 'warn'
            ? 'text-blue-700'
            : 'text-zinc-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

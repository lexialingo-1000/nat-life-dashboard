import { db } from '@/db/client';
import {
  suppliers,
  supplierContacts,
  supplierDocuments,
  documentTypes,
  marchesTravaux,
  marcheSousLots,
  marcheTaches,
  marcheLotAffectations,
  properties,
  companies,
  companyAccountingDocuments,
  rooms,
  levels,
  lots,
} from '@/db/schema';
import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  addContactAction,
  deleteContactAction,
  deleteSupplierAction,
  toggleSupplierActiveAction,
  uploadSupplierDocumentAction,
  deleteSupplierDocumentAction,
  getSupplierDocumentUrlAction,
} from '../actions';
import { Plus, Mail, Phone, Briefcase, Pencil } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { SectionTitle } from '@/components/section-title';
import { PdfDownloadButton } from '@/components/pdf-download-button';
import { DeleteButton } from '@/components/delete-button';
import { ContactDeleteButton } from '@/components/contact-delete-button';
import { DocumentsManager } from '@/components/documents-manager';
import { Tabs, type TabItem } from '@/components/tabs';
import { NotesCard } from '@/components/notes-card';
import { SupplierMarchesTable } from '@/components/supplier-marches-table';
import { type TacheListRow } from '@/components/taches-list-table';
import { TachesGroupedByMarche } from '@/components/taches-grouped-by-marche';
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
} from '../../societes/accounting-actions';
import { createMarcheInlineAction } from '../../marches/actions';
import { slugify } from '@/lib/storage/minio';

export const dynamic = 'force-dynamic';

const INVOICING_LABELS: Record<string, string> = {
  pennylane: 'Pennylane',
  email_forward: 'Email',
  scraping_required: 'Scraping requis',
  manual_upload: 'Manuel',
};

export default async function FournisseurDetailPage({ params }: { params: { id: string } }) {
  const supplierRow = await db.select().from(suppliers).where(eq(suppliers.id, params.id)).limit(1);
  if (supplierRow.length === 0) notFound();
  const s = supplierRow[0];

  const contacts = await db
    .select()
    .from(supplierContacts)
    .where(eq(supplierContacts.supplierId, s.id))
    .orderBy(asc(supplierContacts.createdAt));

  const docs = await db
    .select({
      id: supplierDocuments.id,
      name: supplierDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: supplierDocuments.storageKey,
      expiresAt: supplierDocuments.expiresAt,
      documentDate: supplierDocuments.documentDate,
      uploadedAt: supplierDocuments.uploadedAt,
      // V1.12 R2 — catégorie héritée du type (col legacy `category` retirée).
      category: documentTypes.category,
    })
    .from(supplierDocuments)
    .innerJoin(documentTypes, eq(supplierDocuments.typeId, documentTypes.id))
    .where(eq(supplierDocuments.supplierId, s.id))
    .orderBy(asc(documentTypes.sortOrder));

  const supplierTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'supplier'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const supplierMarches = await db
    .select({
      id: marchesTravaux.id,
      name: marchesTravaux.name,
      status: marchesTravaux.status,
      amountHt: marchesTravaux.amountHt,
      dateDebutPrevu: marchesTravaux.dateDebutPrevu,
      dateFinReelle: marchesTravaux.dateFinReelle,
      propertyId: properties.id,
      propertyName: properties.name,
    })
    .from(marchesTravaux)
    .innerJoin(properties, eq(properties.id, marchesTravaux.propertyId))
    .where(eq(marchesTravaux.supplierId, s.id))
    .orderBy(desc(marchesTravaux.dateDebutPrevu));

  // V1.13 R6 + V1.14 F-1/F-2/F-3 — toutes les tâches des marchés du
  // fournisseur (onglet "Suivi tâches"). JOIN lots+properties pour rupture par
  // lot immo (F-2), photos[] pour bouton upload (F-3).
  // Source : Remarques client dashboard-18 §"LISTE DE SUIVI DE TACHES DANS
  // FOURNISSEURS".
  const supplierTaches = await db
    .select({
      id: marcheTaches.id,
      title: marcheTaches.title,
      status: marcheTaches.status,
      dueDate: marcheTaches.dueDate,
      locationDescription: marcheTaches.locationDescription,
      photos: marcheTaches.photos,
      marcheId: marchesTravaux.id,
      marcheName: marchesTravaux.name,
      sousLotId: marcheSousLots.id,
      sousLotName: marcheSousLots.name,
      lotId: lots.id,
      lotName: lots.name,
      propertyId: properties.id,
      propertyName: properties.name,
      roomName: rooms.name,
      levelName: levels.name,
    })
    .from(marcheTaches)
    .innerJoin(marcheSousLots, eq(marcheSousLots.id, marcheTaches.marcheSousLotId))
    .innerJoin(marchesTravaux, eq(marchesTravaux.id, marcheSousLots.marcheId))
    .innerJoin(lots, eq(lots.id, marcheTaches.lotId))
    .innerJoin(properties, eq(properties.id, lots.propertyId))
    .leftJoin(rooms, eq(rooms.id, marcheTaches.roomId))
    .leftJoin(levels, eq(levels.id, rooms.levelId))
    .where(eq(marchesTravaux.supplierId, s.id))
    .orderBy(asc(marcheTaches.dueDate), asc(marcheTaches.createdAt));

  const displayName =
    s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? 'Fournisseur';

  const expiringDocsCount = docs.filter((d) => {
    if (!d.expiresAt) return false;
    const days = Math.floor(
      (new Date(d.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
    return days < 30;
  }).length;

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi
          label="État"
          value={s.isActive ? 'Actif' : 'Inactif'}
          variant={s.isActive ? 'good' : 'warn'}
        />
        <Kpi label="Contacts" value={contacts.length} />
        <Kpi label="Documents" value={docs.length} />
        <Kpi
          label="Docs à renouveler"
          value={expiringDocsCount}
          variant={expiringDocsCount > 0 ? 'warn' : 'default'}
        />
      </div>
      <NotesCard notes={s.notes} />
    </div>
  );

  const identityTab = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <SectionTitle>Identité</SectionTitle>
        <dl className="space-y-2 text-[13px]">
          <Row label="Raison sociale">{s.companyName ?? '—'}</Row>
          <Row label="Prénom">{s.firstName ?? '—'}</Row>
          <Row label="Nom">{s.lastName ?? '—'}</Row>
          <Row label="Adresse">{s.address ?? '—'}</Row>
        </dl>
      </div>
      <div className="card p-5">
        <SectionTitle>Coordonnées &amp; facturation</SectionTitle>
        <dl className="space-y-2 text-[13px]">
          <Row label="Email">{s.email ?? '—'}</Row>
          <Row label="Téléphone">
            <span className="font-mono">{s.phone ?? '—'}</span>
          </Row>
          <Row label="Mode facturation">
            <span className="badge-neutral">
              {INVOICING_LABELS[s.invoicingType] ?? s.invoicingType}
            </span>
          </Row>
          <Row label="Pennylane ID">
            <span className="font-mono text-[12px]">{s.pennylaneSupplierId ?? '—'}</span>
          </Row>
        </dl>
      </div>
    </div>
  );

  const contactsTab = (
    <div className="card p-6">
      <ul className="space-y-2">
        {contacts.length === 0 && (
          <li className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
            Aucun contact pour l'instant.
          </li>
        )}
        {contacts.map((c) => {
          const contactLabel =
            `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email || 'contact';
          return (
            <li
              key={c.id}
              className="flex items-start justify-between rounded-md border border-zinc-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'}
                </div>
                {c.function && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                    <Briefcase className="h-3 w-3" />
                    {c.function}
                  </div>
                )}
                <div className="mt-1 space-y-0.5 text-xs text-zinc-500">
                  {c.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {c.phone}
                    </div>
                  )}
                </div>
              </div>
              <ContactDeleteButton
                action={deleteContactAction}
                contactId={c.id}
                supplierId={s.id}
                contactLabel={contactLabel}
              />
            </li>
          );
        })}
      </ul>

      <form
        key={contacts.length}
        action={addContactAction}
        className="mt-6 space-y-2 border-t border-zinc-100 pt-6"
      >
        <input type="hidden" name="supplierId" value={s.id} />
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Ajouter un contact
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input name="firstName" placeholder="Prénom" className="input" />
          <input name="lastName" placeholder="Nom" className="input" />
        </div>
        <input name="function" placeholder="Fonction (ex: commercial)" className="input" />
        <div className="grid grid-cols-2 gap-2">
          <input name="email" type="email" placeholder="Email" className="input" />
          <input name="phone" placeholder="Téléphone" className="input" />
        </div>
        <button type="submit" className="btn-secondary w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </button>
      </form>
    </div>
  );

  const marchesTab = (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link href={`/marches/new?supplierId=${s.id}`} className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouveau marché
        </Link>
      </div>
      <div className="card overflow-hidden">
        <SupplierMarchesTable
          rows={supplierMarches.map((m) => ({
            id: m.id,
            name: m.name,
            status: m.status,
            amountHt: m.amountHt,
            dateDebutPrevu: m.dateDebutPrevu,
            dateFinReelle: m.dateFinReelle,
            propertyId: m.propertyId,
            propertyName: m.propertyName,
          }))}
        />
      </div>
    </div>
  );

  // V1.13 R1 — labels catégories dynamiques (renames admin propagés).
  const docCategoriesMap = await loadDocumentCategoriesMap();

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="suppliers"
        parentId={s.id}
        parentSlug={slugify(displayName)}
        parentIdFieldName="supplierId"
        documents={docs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
          uploadedAt:
            d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
          category: d.category,
        }))}
        availableTypes={supplierTypes}
        uploadAction={uploadSupplierDocumentAction}
        deleteAction={deleteSupplierDocumentAction}
        getUrlAction={getSupplierDocumentUrlAction}
        categoriesMap={docCategoriesMap}
      />
    </div>
  );

  // V12bis PR5 B2 + V1.10 refactor — Compta agrégée passée au composant compta
  // unifié <AccountingDocumentsManager scope="supplier">. Devis / commandes /
  // factures rattachés à ce fournisseur, toutes sociétés confondues.
  const supplierAccountingDocs = await db
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
      parentDevisId: companyAccountingDocuments.parentDevisId,
      parentCommandeId: companyAccountingDocuments.parentCommandeId,
      companyId: companies.id,
      companyName: companies.name,
      marcheId: marchesTravaux.id,
      // v19-2a — colonne MARCHE doit afficher la description du marché
      // (ex: "Second-Oeuvre") plutôt que son name. Fallback name si description nulle.
      marcheName: sql<
        string | null
      >`COALESCE(${marchesTravaux.description}, ${marchesTravaux.name})`,
    })
    .from(companyAccountingDocuments)
    .innerJoin(companies, eq(companies.id, companyAccountingDocuments.companyId))
    .leftJoin(marchesTravaux, eq(marchesTravaux.id, companyAccountingDocuments.marcheId))
    .where(eq(companyAccountingDocuments.supplierId, s.id))
    .orderBy(
      desc(companyAccountingDocuments.documentDate),
      desc(companyAccountingDocuments.uploadedAt),
    );

  // V1.10 §4 §5 — résolution labels parents.
  const supplierParentIds = new Set<string>();
  for (const d of supplierAccountingDocs) {
    if (d.parentDevisId) supplierParentIds.add(d.parentDevisId);
    if (d.parentCommandeId) supplierParentIds.add(d.parentCommandeId);
  }
  const supplierParentRows =
    supplierParentIds.size > 0
      ? await db
          .select({
            id: companyAccountingDocuments.id,
            kind: companyAccountingDocuments.kind,
            name: companyAccountingDocuments.name,
            documentDate: companyAccountingDocuments.documentDate,
          })
          .from(companyAccountingDocuments)
          .where(inArray(companyAccountingDocuments.id, Array.from(supplierParentIds)))
      : [];
  const supplierParentById = new Map(supplierParentRows.map((p) => [p.id, p]));
  const formatSupplierParentLabel = (id: string | null): string | null => {
    if (!id) return null;
    const p = supplierParentById.get(id);
    if (!p) return null;
    const kindLabel = p.kind === 'devis' ? 'Devis' : p.kind === 'commande' ? 'Commande' : 'Facture';
    return `${kindLabel} ${p.name}${p.documentDate ? ` (${p.documentDate})` : ''}`;
  };

  // v19-2b — Résolution lots du marché pour chaque facture, pour rupture par
  // LOT dans le tableau compta. Un marché peut concerner 0..N lots ; on prend
  // le premier lot pour la clé de groupement (cas typique : marché = 1 lot).
  const supplierMarcheIds = Array.from(
    new Set(supplierAccountingDocs.map((d) => d.marcheId).filter((x): x is string => !!x)),
  );
  const marcheLotRows =
    supplierMarcheIds.length > 0
      ? await db
          .select({
            marcheId: marcheLotAffectations.marcheId,
            lotId: lots.id,
            lotName: lots.name,
            propertyName: properties.name,
          })
          .from(marcheLotAffectations)
          .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
          .innerJoin(properties, eq(properties.id, lots.propertyId))
          .where(inArray(marcheLotAffectations.marcheId, supplierMarcheIds))
      : [];
  const firstLotByMarcheId = new Map<
    string,
    { lotId: string; lotName: string; propertyName: string }
  >();
  for (const r of marcheLotRows) {
    if (!firstLotByMarcheId.has(r.marcheId)) {
      firstLotByMarcheId.set(r.marcheId, {
        lotId: r.lotId,
        lotName: r.lotName,
        propertyName: r.propertyName,
      });
    }
  }

  const supplierAccountingRows: AccountingRow[] = supplierAccountingDocs.map((d) => {
    const lotInfo = d.marcheId ? (firstLotByMarcheId.get(d.marcheId) ?? null) : null;
    return {
      id: d.id,
      kind: d.kind as AccountingDocKind,
      name: d.name,
      originalFilename: d.originalFilename ?? null,
      storageKey: d.storageKey,
      documentDate: d.documentDate,
      amountHt: d.amountHt,
      amountTtc: d.amountTtc,
      uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
      companyId: d.companyId,
      companyName: d.companyName,
      supplierId: s.id,
      supplierLabel: displayName,
      marcheId: d.marcheId ?? null,
      marcheLabel: d.marcheName ?? null,
      lotId: lotInfo?.lotId ?? null,
      lotName: lotInfo?.lotName ?? null,
      propertyName: lotInfo?.propertyName ?? null,
      parentDevisLabel: formatSupplierParentLabel(d.parentDevisId),
      parentCommandeLabel: formatSupplierParentLabel(d.parentCommandeId),
    };
  });

  const supplierComptaTotalHt = supplierAccountingRows.reduce(
    (acc, r) => acc + (r.amountHt ? Number(r.amountHt) : 0),
    0,
  );
  const supplierComptaTotalTtc = supplierAccountingRows.reduce(
    (acc, r) => acc + (r.amountTtc ? Number(r.amountTtc) : 0),
    0,
  );

  // Companies + marches actifs pour le form upload (scope=supplier autorise
  // l'utilisateur à choisir n'importe quelle société émettrice + n'importe
  // quel marché).
  const companiesForSupplier = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));
  const companyOpts = companiesForSupplier.map((c) => ({
    id: c.id,
    label: c.name,
    slug: slugify(c.name),
  }));

  // Marchés de ce fournisseur (vu que les marchés sont déjà filtrés par
  // supplier_id côté query, on ne propose que ceux-ci pour le form upload).
  const marcheOptsForSupplier = supplierMarches.map((m) => ({
    id: m.id,
    label: `${m.name} — ${m.propertyName}`,
    supplierId: s.id,
  }));

  // Parents devis / commandes existants de ce fournisseur.
  const devisOptsForSupplier = supplierAccountingRows
    .filter((r) => r.kind === 'devis')
    .map((r) => ({
      id: r.id,
      label: `${r.name}${r.documentDate ? ` (${r.documentDate})` : ''}`,
      supplierId: s.id,
      marcheId: r.marcheId,
      companyId: r.companyId,
    }));
  const commandeOptsForSupplier = supplierAccountingRows
    .filter((r) => r.kind === 'commande')
    .map((r) => ({
      id: r.id,
      label: `${r.name}${r.documentDate ? ` (${r.documentDate})` : ''}`,
      supplierId: s.id,
      marcheId: r.marcheId,
      companyId: r.companyId,
    }));

  // V1.13 R6 + V1.14 F-1/F-2/F-3 — onglet Suivi tâches refondu avec filtres
  // toutes colonnes, tri, rupture par lot immo, upload photos.
  const tacheRows: TacheListRow[] = supplierTaches.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueDate: t.dueDate,
    marcheId: t.marcheId,
    marcheName: t.marcheName,
    sousLotId: t.sousLotId,
    sousLotName: t.sousLotName,
    lotId: t.lotId,
    lotName: t.lotName,
    propertyId: t.propertyId,
    propertyName: t.propertyName,
    roomName: t.roomName,
    levelName: t.levelName,
    locationDescription: t.locationDescription,
    photos: Array.isArray(t.photos) ? t.photos : [],
  }));

  const tachesTab = (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <SectionTitle className="mb-0">Suivi des travaux</SectionTitle>
        <div className="flex items-center gap-3">
          <PdfDownloadButton supplierId={s.id} label="PDF" />
          <Link
            href={`/taches/new?supplierId=${s.id}&returnTo=${encodeURIComponent(
              `/fournisseurs/${s.id}?tab=taches`,
            )}`}
            className="text-[12px] text-blue-700 underline decoration-blue-700/35 underline-offset-[3px] hover:decoration-blue-700"
          >
            + Ajouter une tâche
          </Link>
        </div>
      </div>
      <TachesGroupedByMarche rows={tacheRows} returnTo={`/fournisseurs/${s.id}?tab=taches`} />
    </div>
  );

  // V20 §6 — création de marché à la volée depuis les écrans devis/commande/
  // facture du fournisseur (le bouton n'existait que sur la fiche société).
  // Un marché peut être rattaché à n'importe quel bien (toutes sociétés).
  const allPropertyOpts = (
    await db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .orderBy(asc(properties.name))
  ).map((p) => ({ id: p.id, label: p.name }));

  const facturesTab = (
    <div className="card p-6">
      <AccountingDocumentsManager
        scope="supplier"
        parentId={s.id}
        parentLabel={displayName}
        rows={supplierAccountingRows}
        totalHt={supplierComptaTotalHt}
        totalTtc={supplierComptaTotalTtc}
        companies={companyOpts}
        suppliers={[{ id: s.id, label: displayName }]}
        marches={marcheOptsForSupplier}
        devisOptions={devisOptsForSupplier}
        commandeOptions={commandeOptsForSupplier}
        createMarcheAction={createMarcheInlineAction}
        properties={allPropertyOpts}
        uploadAction={uploadAccountingDocAction}
        deleteAction={deleteAccountingDocAction}
        getUrlAction={getAccountingDocUrlAction}
        groupByLot
      />
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    { id: 'contacts', label: 'Contacts', count: contacts.length, content: contactsTab },
    {
      id: 'marches',
      label: 'Marchés',
      count: supplierMarches.length || undefined,
      content: marchesTab,
    },
    // V1.13 R6 — Suivi des tâches (Remarques client dashboard-17).
    {
      id: 'taches',
      label: 'Suivi travaux',
      count: supplierTaches.length || undefined,
      content: tachesTab,
    },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
    {
      id: 'factures',
      label: 'Compta',
      count: supplierAccountingDocs.length || undefined,
      content: facturesTab,
    },
  ];

  return (
    <div className={`space-y-8 ${s.isActive ? '' : 'opacity-75'}`}>
      <BackLink fallbackHref="/fournisseurs" label="Fournisseurs" />

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
            Fournisseur
          </div>
          <h1 className="mt-1.5 flex items-baseline gap-3 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{displayName}</span>
            {!s.isActive && <span className="badge-neutral">Inactif</span>}
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {s.address ?? '—'} · {s.email ?? '—'} · {s.phone ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/fournisseurs/${s.id}/edit`}
            className="btn-secondary inline-flex items-center"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <form action={toggleSupplierActiveAction}>
            <input type="hidden" name="id" value={s.id} />
            <button type="submit" className="btn-secondary">
              {s.isActive ? 'Désactiver' : 'Réactiver'}
            </button>
          </form>
          <DeleteButton
            action={deleteSupplierAction}
            id={s.id}
            label="Supprimer"
            confirmationPhrase={displayName}
            description={`Cette action est irréversible. Le fournisseur "${displayName}", ses contacts et ses documents seront supprimés.`}
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
  variant?: 'default' | 'warn' | 'good';
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
            : variant === 'warn' && value !== 0 && value !== 'Actif'
              ? 'text-zinc-500'
              : 'text-zinc-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

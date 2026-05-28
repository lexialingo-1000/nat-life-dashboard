'use client';

// V1.10 — Composant compta unifié (refactor de la V1.9 où 2 composants
// indépendants existaient : ce fichier pour Société + `<MarcheComptaTable>`
// pour Marché, plus une table read-only inline sur fiche Fournisseur).
// Désormais 1 composant param par `scope` qui rend la même UI (liste unifiée
// style Marché + filtres style Société) sur les 3 scopes : company, marche,
// supplier. Garantit qu'un changement de format sur un onglet impacte
// automatiquement tous les autres.

import { useMemo, useState, useTransition } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Download, Loader2, Pencil, Plus, Trash2, Upload, UploadCloud } from 'lucide-react';
import { DataTable } from './data-table';
import { EntityCombobox, type ComboboxOption } from './entity-combobox';
import { MarcheInlineCreator } from './marche-inline-creator';
import { formatDate } from '@/lib/utils';

export type AccountingDocKind = 'devis' | 'commande' | 'facture';
export type AccountingScope = 'company' | 'marche' | 'supplier';

const KIND_LABEL: Record<AccountingDocKind, string> = {
  devis: 'Devis',
  commande: 'Commande',
  facture: 'Facture',
};

const KIND_LABEL_NEW: Record<AccountingDocKind, string> = {
  devis: 'Nouveau devis',
  commande: 'Nouvelle commande',
  facture: 'Nouvelle facture',
};

const KIND_BADGE: Record<AccountingDocKind, string> = {
  devis: 'bg-zinc-100 text-zinc-700',
  commande: 'bg-blue-100 text-blue-700',
  facture: 'bg-emerald-100 text-emerald-700',
};

const KIND_ORDER: AccountingDocKind[] = ['devis', 'commande', 'facture'];

export interface AccountingRow {
  id: string;
  kind: AccountingDocKind;
  name: string;
  /** Nom de fichier original (V1.10 §8). Fallback `name` si null. */
  originalFilename: string | null;
  storageKey: string;
  documentDate: string | null;
  amountHt: string | null;
  amountTtc: string | null;
  companyId: string;
  companyName: string;
  supplierId: string;
  supplierLabel: string;
  marcheId: string | null;
  marcheLabel: string | null;
  /** v19-2b — lot immo dérivé du marché (1er lot si marché multi-lots). Null si
   *  marché parties communes ou facture sans marché. Utilisé pour rupture LOT. */
  lotId?: string | null;
  lotName?: string | null;
  propertyName?: string | null;
  /** Label devis lié (visible colonne "Lié à" pour commande/facture). */
  parentDevisLabel: string | null;
  /** Label commande liée (visible colonne "Lié à" pour facture). */
  parentCommandeLabel: string | null;
  uploadedAt: string;
}

export interface CompanyOption {
  id: string;
  label: string;
  slug: string;
}

export interface SupplierOption {
  id: string;
  label: string;
}

export interface MarcheOption {
  id: string;
  label: string;
  supplierId: string;
  companyId?: string;
}

export interface ParentAccountingDocOption {
  id: string;
  label: string;
  supplierId: string;
  marcheId: string | null;
  companyId: string;
}

interface PropertyOption {
  id: string;
  label: string;
}

type InlineCreateResult = { id: string; label: string } | { error: string };

interface Props {
  scope: AccountingScope;
  /** ID du contexte parent. Pour scope=company c'est le companyId ; pour
   *  scope=marche le marcheId ; pour scope=supplier le supplierId. */
  parentId: string;
  /** Label affiché pour le contexte (ex : "FKA" si scope=company). */
  parentLabel: string;
  /** Slug MinIO du parent (utilisé pour le path d'upload). Requis pour
   *  scope=company. Pour marche/supplier on prend le slug de la société
   *  émettrice choisie dans le form. */
  parentSlug?: string;
  /** Pour scope=marche : société par défaut (= société du marché). */
  marcheDefaultCompanyId?: string;
  /** Pour scope=marche : fournisseur par défaut (= fournisseur du marché). */
  marcheDefaultSupplierId?: string;

  rows: AccountingRow[];
  totalHt: number;
  totalTtc: number;

  /** Options référentielles pour form + filtres (toujours fournies). */
  companies: CompanyOption[];
  suppliers: SupplierOption[];
  marches: MarcheOption[];

  /** Optionnel : création inline depuis le form. */
  createSupplierAction?: (formData: FormData) => Promise<InlineCreateResult>;
  createMarcheAction?: (formData: FormData) => Promise<InlineCreateResult>;
  /** Properties de la société courante (pour MarcheInlineCreator). */
  properties?: PropertyOption[];

  /** Devis & commandes existants pour dropdowns parents du form upload. */
  devisOptions?: ParentAccountingDocOption[];
  commandeOptions?: ParentAccountingDocOption[];

  /** Server actions (déjà partagées entre Société et Marché V1.9). */
  uploadAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  getUrlAction: (formData: FormData) => Promise<{ url: string } | { error: string }>;

  /** v19-2b — Active la rupture par LOT immobilier (section + sous-total par lot).
   *  Pertinent uniquement sur scope=supplier. Default false. */
  groupByLot?: boolean;
}

export function AccountingDocumentsManager({
  scope,
  parentId,
  parentLabel,
  parentSlug,
  marcheDefaultCompanyId,
  marcheDefaultSupplierId,
  rows,
  totalHt,
  totalTtc,
  companies,
  suppliers,
  marches: initialMarches,
  createSupplierAction,
  createMarcheAction,
  properties = [],
  devisOptions = [],
  commandeOptions = [],
  uploadAction,
  deleteAction,
  getUrlAction,
  groupByLot = false,
}: Props) {
  const [marches, setMarches] = useState<MarcheOption[]>(initialMarches);

  // ----- Form state -----
  const [uploadKind, setUploadKind] = useState<AccountingDocKind | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Defaults selon scope (verrouillage de la valeur "parent")
  const defaultCompanyId = useMemo(() => {
    if (scope === 'company') return parentId;
    if (scope === 'marche') return marcheDefaultCompanyId ?? '';
    return '';
  }, [scope, parentId, marcheDefaultCompanyId]);

  const defaultSupplierId = useMemo(() => {
    if (scope === 'supplier') return parentId;
    if (scope === 'marche') return marcheDefaultSupplierId ?? '';
    return '';
  }, [scope, parentId, marcheDefaultSupplierId]);

  const defaultMarcheId = scope === 'marche' ? parentId : '';

  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [marcheId, setMarcheId] = useState(defaultMarcheId);
  const [docName, setDocName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [amountHt, setAmountHt] = useState('');
  const [amountTtc, setAmountTtc] = useState('');
  const [notes, setNotes] = useState('');
  const [parentDevisId, setParentDevisId] = useState('');
  const [parentCommandeId, setParentCommandeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // ----- Filters bar state -----
  // Type : multi-checkbox. Vide = aucun filtre (tout afficher).
  const [filterKinds, setFilterKinds] = useState<Set<AccountingDocKind>>(new Set());
  const [filterSupplierId, setFilterSupplierId] = useState<string>('');
  const [filterMarcheId, setFilterMarcheId] = useState<string>('');
  const [filterCompanyId, setFilterCompanyId] = useState<string>('');

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId]
  );

  // Marchés filtrés par fournisseur sélectionné (sans masquer les autres)
  const marcheOptionsForCombobox = useMemo(() => {
    const all = marches.map((m) => ({ id: m.id, label: m.label, supplierId: m.supplierId }));
    if (!supplierId) return all.map(({ id, label }) => ({ id, label }));
    const own = all.filter((m) => m.supplierId === supplierId);
    const others = all.filter((m) => m.supplierId !== supplierId);
    return [...own, ...others].map(({ id, label }) => ({ id, label }));
  }, [supplierId, marches]);

  const visibleDevis = useMemo(
    () =>
      devisOptions
        .filter((d) => !supplierId || d.supplierId === supplierId)
        .filter((d) => !marcheId || !d.marcheId || d.marcheId === marcheId)
        .filter((d) => !companyId || d.companyId === companyId),
    [devisOptions, supplierId, marcheId, companyId]
  );
  const visibleCommandes = useMemo(
    () =>
      commandeOptions
        .filter((c) => !supplierId || c.supplierId === supplierId)
        .filter((c) => !marcheId || !c.marcheId || c.marcheId === marcheId)
        .filter((c) => !companyId || c.companyId === companyId),
    [commandeOptions, supplierId, marcheId, companyId]
  );

  const resetForm = () => {
    setUploadKind(null);
    setFile(null);
    setCompanyId(defaultCompanyId);
    setSupplierId(defaultSupplierId);
    setMarcheId(defaultMarcheId);
    setDocName('');
    setDocumentDate('');
    setAmountHt('');
    setAmountTtc('');
    setNotes('');
    setParentDevisId('');
    setParentCommandeId('');
    setError(null);
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      if (!uploadKind) setUploadKind('facture'); // défaut = facture
      if (!docName) setDocName(dropped.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleDownload = (storageKey: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('storageKey', storageKey);
      const res = await getUrlAction(fd);
      if ('url' in res) {
        const a = document.createElement('a');
        a.href = res.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert(`Erreur : ${res.error}`);
      }
    });
  };

  const handleDelete = (row: AccountingRow) => {
    const label = row.originalFilename ?? row.name;
    if (
      !confirm(
        `Supprimer ${KIND_LABEL[row.kind].toLowerCase()} "${label}" ? Cette action est irréversible.`
      )
    )
      return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('documentId', row.id);
      fd.set('companyId', row.companyId);
      await deleteAction(fd);
    });
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!uploadKind) return;
    if (!file) {
      setError('Choisis un fichier');
      return;
    }
    if (!companyId) {
      setError('Société émettrice obligatoire');
      return;
    }
    if (!supplierId) {
      setError('Fournisseur obligatoire');
      return;
    }
    if (!docName.trim()) {
      setError('Nom requis');
      return;
    }
    if (!selectedCompany) {
      setError('Société invalide');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1) presigned URL via /api/upload (scope=companies)
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'companies',
          parentSlug: selectedCompany.slug,
          parentId: companyId,
          fileName: file.name,
        }),
      });
      if (!presignRes.ok) {
        const errBody = await presignRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? 'Erreur presign');
      }
      const { uploadUrl, storageKey } = await presignRes.json();

      // 2) PUT direct MinIO
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error('Upload MinIO échoué');

      // 3) Server action insert DB
      const fd = new FormData();
      fd.set('companyId', companyId);
      fd.set('supplierId', supplierId);
      if (marcheId) fd.set('marcheId', marcheId);
      fd.set('kind', uploadKind);
      fd.set('name', docName.trim());
      fd.set('storageKey', storageKey);
      fd.set('originalFilename', file.name);
      if (documentDate) fd.set('documentDate', documentDate);
      if (amountHt) fd.set('amountHt', amountHt);
      if (amountTtc) fd.set('amountTtc', amountTtc);
      if (parentDevisId) fd.set('parentDevisId', parentDevisId);
      if (parentCommandeId) fd.set('parentCommandeId', parentCommandeId);
      if (notes) fd.set('notes', notes);
      await uploadAction(fd);

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
      setUploading(false);
    }
  };

  // ----- Filtering rows -----
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterKinds.size > 0 && !filterKinds.has(r.kind)) return false;
      if (filterSupplierId && r.supplierId !== filterSupplierId) return false;
      if (filterMarcheId && r.marcheId !== filterMarcheId) return false;
      if (filterCompanyId && r.companyId !== filterCompanyId) return false;
      return true;
    });
  }, [rows, filterKinds, filterSupplierId, filterMarcheId, filterCompanyId]);

  const filteredTotalHt = useMemo(
    () =>
      filteredRows.reduce((acc, r) => acc + (r.amountHt ? Number(r.amountHt) : 0), 0),
    [filteredRows]
  );
  const filteredTotalTtc = useMemo(
    () =>
      filteredRows.reduce((acc, r) => acc + (r.amountTtc ? Number(r.amountTtc) : 0), 0),
    [filteredRows]
  );

  // v19-2b — Groupement par LOT immo (sur scope=supplier). Si groupByLot=false
  // on garde un groupe unique pour préserver le rendu existant.
  const rowGroups = useMemo(() => {
    if (!groupByLot) {
      return [
        {
          key: '__all__',
          label: '',
          rows: filteredRows,
          subtotalHt: filteredTotalHt,
          subtotalTtc: filteredTotalTtc,
        },
      ];
    }
    const map = new Map<
      string,
      { label: string; rows: AccountingRow[]; subtotalHt: number; subtotalTtc: number }
    >();
    for (const r of filteredRows) {
      const key = r.lotId ?? '__commun__';
      const label = r.lotId
        ? `${r.propertyName ?? '—'} · ${r.lotName ?? '—'}`
        : 'Parties communes / sans marché';
      const g = map.get(key) ?? { label, rows: [], subtotalHt: 0, subtotalTtc: 0 };
      g.rows.push(r);
      g.subtotalHt += r.amountHt ? Number(r.amountHt) : 0;
      g.subtotalTtc += r.amountTtc ? Number(r.amountTtc) : 0;
      map.set(key, g);
    }
    // Trier : "Parties communes" en dernier, le reste alphabétique sur label.
    return Array.from(map.entries())
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => {
        if (a.key === '__commun__') return 1;
        if (b.key === '__commun__') return -1;
        return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
      });
  }, [groupByLot, filteredRows, filteredTotalHt, filteredTotalTtc]);

  const showCompanyColumn = scope !== 'company';
  const showSupplierColumn = scope !== 'supplier';
  const showCompanyFilter = scope !== 'company';
  const showSupplierFilter = scope !== 'supplier';
  const showMarcheFilter = scope !== 'marche';

  const toggleKindFilter = (k: AccountingDocKind) => {
    setFilterKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // ----- Columns DataTable -----
  const columns = useMemo<ColumnDef<AccountingRow>[]>(() => {
    const cols: ColumnDef<AccountingRow>[] = [
      {
        accessorKey: 'kind',
        header: 'Type',
        cell: ({ row }) => (
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${
              KIND_BADGE[row.original.kind] ?? ''
            }`}
          >
            {KIND_LABEL[row.original.kind] ?? row.original.kind}
          </span>
        ),
        // V1.11 — filtre user-friendly : matche le label visible (Devis/Commande/Facture).
        filterFn: (row, _id, value) => {
          const label = KIND_LABEL[row.original.kind] ?? row.original.kind;
          return label.toLowerCase().includes(String(value).toLowerCase());
        },
      },
    ];

    if (showCompanyColumn) {
      cols.push({
        accessorKey: 'companyName',
        header: 'Société',
        cell: ({ row }) => (
          <Link
            href={`/societes/${row.original.companyId}`}
            className="link-cell-soft text-[12px]"
          >
            {row.original.companyName}
          </Link>
        ),
      });
    }

    if (showSupplierColumn) {
      cols.push({
        accessorKey: 'supplierLabel',
        header: 'Fournisseur',
        cell: ({ row }) => (
          <Link
            href={`/fournisseurs/${row.original.supplierId}`}
            className="link-cell-soft text-[12px]"
          >
            {row.original.supplierLabel}
          </Link>
        ),
      });
    }

    cols.push({
      accessorKey: 'marcheLabel',
      header: 'Marché',
      cell: ({ row }) =>
        row.original.marcheId && row.original.marcheLabel ? (
          <Link
            href={`/marches/${row.original.marcheId}`}
            className="link-cell-soft text-[12px]"
          >
            {row.original.marcheLabel}
          </Link>
        ) : (
          <span className="text-zinc-300">—</span>
        ),
    });

    cols.push({
      accessorKey: 'documentDate',
      header: 'Date',
      sortingFn: 'datetime',
      cell: ({ row }) => (
        <span className="tnum text-[12px] text-zinc-700">
          {formatDate(row.original.documentDate)}
        </span>
      ),
    });

    cols.push({
      id: 'parents',
      header: 'Lié à',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const badges: string[] = [];
        if (row.original.parentDevisLabel) badges.push(`→ ${row.original.parentDevisLabel}`);
        if (row.original.parentCommandeLabel)
          badges.push(`→ ${row.original.parentCommandeLabel}`);
        if (badges.length === 0) return <span className="text-zinc-300">—</span>;
        return (
          <div className="flex flex-col gap-0.5 text-[11px] text-zinc-600">
            {badges.map((b, i) => (
              <span key={i}>{b}</span>
            ))}
          </div>
        );
      },
    });

    cols.push({
      accessorKey: 'name',
      header: 'Document',
      cell: ({ row }) => {
        const display = row.original.originalFilename ?? row.original.name;
        return (
          <button
            type="button"
            onClick={() => handleDownload(row.original.storageKey)}
            disabled={pendingTransition}
            className="link-cell text-left text-[13px] text-zinc-900 disabled:opacity-50"
            title={row.original.name}
          >
            {display}
          </button>
        );
      },
    });

    cols.push({
      accessorKey: 'amountHt',
      header: 'HT',
      enableColumnFilter: false,
      cell: ({ row }) => (
        <span className="tabular-nums text-[13px] text-zinc-500">
          {row.original.amountHt
            ? `${Number(row.original.amountHt).toLocaleString('fr-FR')} €`
            : '—'}
        </span>
      ),
    });

    cols.push({
      accessorKey: 'amountTtc',
      header: 'TTC',
      enableColumnFilter: false,
      cell: ({ row }) => (
        <span className="tabular-nums text-[13px] font-medium">
          {row.original.amountTtc
            ? `${Number(row.original.amountTtc).toLocaleString('fr-FR')} €`
            : '—'}
        </span>
      ),
    });

    cols.push({
      id: 'actions',
      header: '',
      enableSorting: false,
      enableColumnFilter: false,
      size: 120,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/societes/${row.original.companyId}/compta/${row.original.id}/edit`}
            title="Modifier"
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => handleDownload(row.original.storageKey)}
            disabled={pendingTransition}
            title="Télécharger"
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.original)}
            disabled={pendingTransition}
            title="Supprimer"
            className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    });

    return cols;
  }, [pendingTransition, showCompanyColumn, showSupplierColumn]);

  // ----- Render -----
  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      className={`relative space-y-4 rounded-md ${
        isDragging ? 'ring-2 ring-emerald-400 ring-offset-2' : ''
      }`}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-emerald-50/80">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white">
            <UploadCloud className="h-4 w-4" /> Déposer pour ajouter un document compta
          </span>
        </div>
      )}

      {/* Header : totaux + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-zinc-500">
          {filteredRows.length === rows.length ? (
            <>
              {rows.length} document{rows.length > 1 ? 's' : ''} compta
            </>
          ) : (
            <>
              {filteredRows.length} / {rows.length} document{rows.length > 1 ? 's' : ''} (filtré)
            </>
          )}
        </p>
        {filteredRows.length > 0 && (
          <div className="flex flex-col items-end gap-0.5 font-mono text-[12px] tabular-nums text-zinc-700">
            <span>Total HT : {filteredTotalHt.toLocaleString('fr-FR')} €</span>
            <span className="font-medium text-zinc-900">
              Total TTC : {filteredTotalTtc.toLocaleString('fr-FR')} €
            </span>
          </div>
        )}
      </div>

      {/* CTA création */}
      {!uploadKind && (
        <div className="flex flex-wrap gap-2">
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setUploadKind(k)}
              className="btn-secondary"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {KIND_LABEL_NEW[k]}
            </button>
          ))}
        </div>
      )}

      {/* Form upload inline */}
      {uploadKind && (
        <form
          onSubmit={handleUpload}
          className="space-y-4 rounded-md border border-zinc-200 bg-[#fbf8f0] p-5"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-[14px] font-medium text-zinc-900">
              {KIND_LABEL_NEW[uploadKind]}
              {scope === 'marche' && ' — lié à ce marché'}
              {scope === 'supplier' && ` — pour ${parentLabel}`}
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Société émettrice *
              </label>
              {scope === 'company' ? (
                <input value={parentLabel} readOnly className="input mt-1 bg-zinc-100" />
              ) : (
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  required
                  className="input mt-1"
                >
                  <option value="">— Choisir une société —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Fournisseur *
              </label>
              {scope === 'supplier' ? (
                <input value={parentLabel} readOnly className="input mt-1 bg-zinc-100" />
              ) : createSupplierAction ? (
                <EntityCombobox
                  name="__supplierId_combobox"
                  options={suppliers as ComboboxOption[]}
                  defaultValue={supplierId}
                  placeholder="— Choisir un fournisseur —"
                  required
                  onChange={(id) => {
                    setSupplierId(id);
                    if (scope !== 'marche') setMarcheId('');
                  }}
                  createLabel="+ Créer un fournisseur"
                  createAction={createSupplierAction}
                  createFields={['companyName', 'firstName', 'lastName', 'email', 'phone']}
                />
              ) : (
                <select
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    if (scope !== 'marche') setMarcheId('');
                  }}
                  required
                  className="input mt-1"
                >
                  <option value="">— Choisir un fournisseur —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {scope !== 'marche' && (
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Marché (optionnel)
              </label>
              <EntityCombobox
                name="__marcheId_combobox"
                options={marcheOptionsForCombobox as ComboboxOption[]}
                defaultValue={marcheId}
                placeholder={
                  marcheOptionsForCombobox.length === 0
                    ? '— Aucun marché —'
                    : '— Choisir un marché —'
                }
                disabled={marcheOptionsForCombobox.length === 0 && !createMarcheAction}
                onChange={(id) => setMarcheId(id)}
              />
              {createMarcheAction && (
                <MarcheInlineCreator
                  supplierId={supplierId}
                  properties={properties}
                  createAction={createMarcheAction}
                  onCreated={({ id, label }) => {
                    setMarches((prev) => [
                      { id, label, supplierId },
                      ...prev.filter((m) => m.id !== id),
                    ]);
                    setMarcheId(id);
                  }}
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Fichier *</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-[13px]"
            />
            {file && (
              <p className="mt-1 text-[11px] text-zinc-500">
                {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Nom *</label>
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              required
              className="input mt-1"
              placeholder={`${KIND_LABEL[uploadKind]} ${
                uploadKind === 'devis' ? 'travaux' : 'fournisseur'
              } 2026`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Date</label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="input mt-1"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Montant HT (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountHt}
                onChange={(e) => setAmountHt(e.target.value)}
                className="input mt-1 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Montant TTC (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountTtc}
                onChange={(e) => setAmountTtc(e.target.value)}
                className="input mt-1 tabular-nums"
              />
            </div>
          </div>

          {/* V1.10 §4 §5 — liens parents conditionnels par kind */}
          {uploadKind !== 'devis' && (
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Devis lié (optionnel)
              </label>
              <select
                value={parentDevisId}
                onChange={(e) => setParentDevisId(e.target.value)}
                className="input mt-1"
              >
                <option value="">— Aucun devis lié —</option>
                {visibleDevis.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              {visibleDevis.length === 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Aucun devis disponible pour ce fournisseur.
                </p>
              )}
            </div>
          )}
          {uploadKind === 'facture' && (
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Commande liée (optionnel)
              </label>
              <select
                value={parentCommandeId}
                onChange={(e) => setParentCommandeId(e.target.value)}
                className="input mt-1"
              >
                <option value="">— Aucune commande liée —</option>
                {visibleCommandes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {visibleCommandes.length === 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Aucune commande disponible pour ce fournisseur.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input mt-1"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          {error && <p className="rounded bg-red-50 p-2 text-[12px] text-red-800">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              disabled={uploading}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Upload…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Filters bar */}
      {rows.length > 0 && (
        <div className="rounded-md border border-zinc-100 bg-white/40 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
            {/* Filtre Type (chips) */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Type :</span>
              {KIND_ORDER.map((k) => {
                const active = filterKinds.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKindFilter(k)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] transition ${
                      active
                        ? KIND_BADGE[k]
                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                );
              })}
            </div>
            {/* Filtre Fournisseur */}
            {showSupplierFilter && (
              <div className="flex min-w-[200px] flex-1 items-center gap-2">
                <span className="text-zinc-500">Fournisseur :</span>
                <select
                  value={filterSupplierId}
                  onChange={(e) => setFilterSupplierId(e.target.value)}
                  className="input flex-1 py-1 text-[12px]"
                >
                  <option value="">— Tous —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Filtre Marché */}
            {showMarcheFilter && (
              <div className="flex min-w-[200px] flex-1 items-center gap-2">
                <span className="text-zinc-500">Marché :</span>
                <select
                  value={filterMarcheId}
                  onChange={(e) => setFilterMarcheId(e.target.value)}
                  className="input flex-1 py-1 text-[12px]"
                >
                  <option value="">— Tous —</option>
                  {marches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Filtre Société */}
            {showCompanyFilter && (
              <div className="flex min-w-[180px] items-center gap-2">
                <span className="text-zinc-500">Société :</span>
                <select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value)}
                  className="input flex-1 py-1 text-[12px]"
                >
                  <option value="">— Toutes —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Reset filtres si actifs */}
            {(filterKinds.size > 0 ||
              filterSupplierId ||
              filterMarcheId ||
              filterCompanyId) && (
              <button
                type="button"
                onClick={() => {
                  setFilterKinds(new Set());
                  setFilterSupplierId('');
                  setFilterMarcheId('');
                  setFilterCompanyId('');
                }}
                className="ml-auto text-[11px] text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {filteredRows.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-200 p-6 text-center text-[13px] text-zinc-500">
          {rows.length === 0
            ? 'Aucun devis / commande / facture. Utilise les boutons ci-dessus pour en ajouter ou glisse-dépose un fichier ici.'
            : 'Aucun document ne correspond aux filtres actifs.'}
        </p>
      ) : groupByLot ? (
        // v19-2b — Rupture par LOT : un bloc par lot avec sous-total HT/TTC.
        <div className="space-y-6">
          {rowGroups.map((g) => (
            <section key={g.key} className="space-y-2">
              <header className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200 pb-1">
                <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-zinc-700">
                  {g.label}
                  <span className="ml-2 font-mono text-[11px] tnum font-normal text-zinc-400">
                    {g.rows.length}
                  </span>
                </h3>
                <div className="flex flex-col items-end gap-0 font-mono text-[11px] tabular-nums text-zinc-600">
                  <span>HT : {g.subtotalHt.toLocaleString('fr-FR')} €</span>
                  <span className="font-medium text-zinc-800">
                    TTC : {g.subtotalTtc.toLocaleString('fr-FR')} €
                  </span>
                </div>
              </header>
              <DataTable
                columns={columns}
                data={g.rows}
                emptyMessage="Aucun document compta."
                enableFilters={false}
              />
            </section>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredRows}
          emptyMessage="Aucun document compta."
        />
      )}
    </div>
  );
}

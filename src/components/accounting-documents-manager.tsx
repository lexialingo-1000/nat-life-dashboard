'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Download, Loader2, Pencil, Plus, Trash2, Upload, UploadCloud } from 'lucide-react';
import { DataTable } from './data-table';
import { EntityCombobox, type ComboboxOption } from './entity-combobox';
import { MarcheInlineCreator } from './marche-inline-creator';
import { formatDate } from '@/lib/utils';

export type AccountingDocKind = 'devis' | 'commande' | 'facture';

const KIND_LABEL: Record<AccountingDocKind, string> = {
  devis: 'Devis',
  commande: 'Commande',
  facture: 'Facture',
};

const KIND_LABEL_PLURAL: Record<AccountingDocKind, string> = {
  devis: 'Devis',
  commande: 'Commandes',
  facture: 'Factures',
};

const KIND_ARTICLE_NEW: Record<AccountingDocKind, string> = {
  devis: 'Nouveau devis',
  commande: 'Nouvelle commande',
  facture: 'Nouvelle facture',
};

interface AccountingRow {
  id: string;
  supplierLabel: string;
  marcheLabel: string | null;
  name: string;
  // V1.10 §8 — nom de fichier original. Fallback `name` si null (rows pré-migration).
  originalFilename: string | null;
  storageKey: string;
  documentDate: string | null;
  amountHt: string | null;
  // V12bis PR10 §2+§3 — TTC ajouté en plus de HT (retours Natacha dashboard-13).
  amountTtc: string | null;
  // V1.10 §4 §5 — liens parents (labels pour badge colonne "Lié à").
  parentDevisLabel: string | null;
  parentCommandeLabel: string | null;
  uploadedAt: string;
}

interface SupplierOption {
  id: string;
  label: string;
}

interface MarcheOption {
  id: string;
  label: string;
  supplierId: string;
}

// V1.10 §4 §5 — devis/commandes existants pour les dropdowns parents.
export interface ParentAccountingDocOption {
  id: string;
  label: string;
  supplierId: string;
  marcheId: string | null;
}

type InlineCreateResult = { id: string; label: string } | { error: string };

interface PropertyOption {
  id: string;
  label: string;
}

interface Props {
  kind: AccountingDocKind;
  companyId: string;
  companySlug: string;
  documents: AccountingRow[];
  suppliers: SupplierOption[];
  marches: MarcheOption[];
  uploadAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  getUrlAction: (formData: FormData) => Promise<{ url: string } | { error: string }>;
  // V12bis PR3 A4 — création fournisseur à la volée depuis la compta.
  createSupplierAction?: (formData: FormData) => Promise<InlineCreateResult>;
  // V12bis umbrella §2 — création marché à la volée (combobox marché du form upload).
  createMarcheAction?: (formData: FormData) => Promise<InlineCreateResult>;
  /** Propriétés (biens) de la société courante, pour le dialog "Créer marché à la volée". */
  properties?: PropertyOption[];
  // V1.10 §4 §5 — devis et commandes disponibles comme parents (la société courante).
  devisOptions?: ParentAccountingDocOption[];
  commandeOptions?: ParentAccountingDocOption[];
}

export function AccountingDocumentsManager({
  kind,
  companyId,
  companySlug,
  documents,
  suppliers,
  marches: initialMarches,
  uploadAction,
  deleteAction,
  getUrlAction,
  createSupplierAction,
  createMarcheAction,
  properties = [],
  devisOptions = [],
  commandeOptions = [],
}: Props) {
  // V12bis umbrella §2 — marchés en state pour pouvoir ajouter ceux créés inline.
  const [marches, setMarches] = useState<MarcheOption[]>(initialMarches);
  const [isOpen, setOpen] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [marcheId, setMarcheId] = useState('');
  const [docName, setDocName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [amountHt, setAmountHt] = useState('');
  const [amountTtc, setAmountTtc] = useState('');
  const [notes, setNotes] = useState('');
  // V1.10 §4 §5 — liens parents (commande→devis, facture→devis/commande)
  const [parentDevisId, setParentDevisId] = useState('');
  const [parentCommandeId, setParentCommandeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // Filtre parents par fournisseur+marché sélectionnés (et exclut le doc lui-même).
  const visibleDevis = useMemo(
    () =>
      devisOptions
        .filter((d) => !supplierId || d.supplierId === supplierId)
        .filter((d) => !marcheId || !d.marcheId || d.marcheId === marcheId),
    [devisOptions, supplierId, marcheId]
  );
  const visibleCommandes = useMemo(
    () =>
      commandeOptions
        .filter((c) => !supplierId || c.supplierId === supplierId)
        .filter((c) => !marcheId || !c.marcheId || c.marcheId === marcheId),
    [commandeOptions, supplierId, marcheId]
  );

  // V12bis PR9 §2 — fix Natacha "Je n'ai plus la liste des marchés".
  // Avant : filter strict marches.supplier_id === supplierId → liste vide si
  // mismatch ou supplier_id non renseigné. Maintenant : on affiche tous les
  // marchés, et on remonte ceux du fournisseur sélectionné en tête.
  const marcheOptionsForCombobox = useMemo(() => {
    const all = marches.map((m) => ({ id: m.id, label: m.label, supplierId: m.supplierId }));
    if (!supplierId) return all.map(({ id, label }) => ({ id, label }));
    const own = all.filter((m) => m.supplierId === supplierId);
    const others = all.filter((m) => m.supplierId !== supplierId);
    return [...own, ...others].map(({ id, label }) => ({ id, label }));
  }, [supplierId, marches]);

  const reset = () => {
    setOpen(false);
    setFile(null);
    setSupplierId('');
    setMarcheId('');
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

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) { setError('Choisis un fichier'); return; }
    if (!supplierId) { setError('Fournisseur obligatoire'); return; }
    if (!docName.trim()) { setError('Nom requis'); return; }

    setUploading(true);
    setError(null);

    try {
      // 1) presigned URL via /api/upload
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'companies',
          parentSlug: companySlug,
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
      fd.set('kind', kind);
      fd.set('name', docName.trim());
      fd.set('storageKey', storageKey);
      // V1.10 §8 — nom de fichier original.
      fd.set('originalFilename', file.name);
      if (documentDate) fd.set('documentDate', documentDate);
      if (amountHt) fd.set('amountHt', amountHt);
      if (amountTtc) fd.set('amountTtc', amountTtc);
      // V1.10 §4 §5 — liens parents (server-side enforce nullification selon kind).
      if (parentDevisId) fd.set('parentDevisId', parentDevisId);
      if (parentCommandeId) fd.set('parentCommandeId', parentCommandeId);
      if (notes) fd.set('notes', notes);
      await uploadAction(fd);

      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
      setUploading(false);
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
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert(`Erreur : ${res.error}`);
      }
    });
  };

  const handleDelete = (row: AccountingRow) => {
    if (!confirm(`Supprimer ${KIND_LABEL[kind].toLowerCase()} "${row.name}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('documentId', row.id);
      fd.set('companyId', companyId);
      await deleteAction(fd);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) { setFile(f); setOpen(true); }
  };

  const columns = useMemo<ColumnDef<AccountingRow>[]>(
    () => [
      {
        accessorKey: 'supplierLabel',
        header: 'Fournisseur',
        cell: ({ row }) => (
          <span className="text-[13px] font-medium uppercase tracking-[0.02em] text-zinc-900">
            {row.original.supplierLabel}
          </span>
        ),
      },
      {
        accessorKey: 'marcheLabel',
        header: 'Marché',
        cell: ({ row }) => (
          <span className="text-[12px] text-zinc-500">
            {row.original.marcheLabel ?? <span className="text-zinc-300">—</span>}
          </span>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'Date document',
        sortingFn: 'datetime',
        cell: ({ row }) => (
          <span className="tnum text-[12px] text-zinc-700">{formatDate(row.original.documentDate)}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Document',
        cell: ({ row }) => {
          // V1.10 §8 — affiche le nom de fichier original quand disponible
          // (rows pré-migration : fallback sur le titre saisi `name`).
          const display = row.original.originalFilename ?? row.original.name;
          return (
            <button
              type="button"
              onClick={() => handleDownload(row.original.storageKey)}
              disabled={pendingTransition}
              className="link-cell text-left disabled:opacity-50"
              title={row.original.name}
            >
              {display}
            </button>
          );
        },
      },
      // V1.10 §4 §5 — colonne "Lié à" (visible seulement pour commande/facture).
      ...(kind !== 'devis'
        ? [
            {
              id: 'parents',
              header: 'Lié à',
              enableSorting: false,
              enableColumnFilter: false,
              cell: ({ row }: { row: { original: AccountingRow } }) => {
                const badges: string[] = [];
                if (row.original.parentDevisLabel)
                  badges.push(`→ ${row.original.parentDevisLabel}`);
                if (row.original.parentCommandeLabel)
                  badges.push(`→ ${row.original.parentCommandeLabel}`);
                if (badges.length === 0)
                  return <span className="text-zinc-300">—</span>;
                return (
                  <div className="flex flex-col gap-0.5 text-[11px] text-zinc-600">
                    {badges.map((b, i) => (
                      <span key={i}>{b}</span>
                    ))}
                  </div>
                );
              },
            } as ColumnDef<AccountingRow>,
          ]
        : []),
      {
        accessorKey: 'amountHt',
        header: 'HT',
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-[13px] text-zinc-500">
            {row.original.amountHt ? `${Number(row.original.amountHt).toLocaleString('fr-FR')} €` : '—'}
          </span>
        ),
      },
      // V12bis PR10 §2+§3 — colonne TTC ajoutée (retours Natacha dashboard-13).
      {
        accessorKey: 'amountTtc',
        header: 'TTC',
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-[13px] font-medium">
            {row.original.amountTtc ? `${Number(row.original.amountTtc).toLocaleString('fr-FR')} €` : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableColumnFilter: false,
        size: 110,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {/* V12bis umbrella §2 — modifier le doc compta. */}
            <Link
              href={`/societes/${companyId}/compta/${row.original.id}/edit`}
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
      },
    ],
    [pendingTransition, kind, companyId]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      className={`relative space-y-3 ${isDragging ? 'rounded-md ring-2 ring-emerald-400 ring-offset-2' : ''}`}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-emerald-50/80">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white">
            <UploadCloud className="h-4 w-4" /> Déposer pour ajouter un {KIND_LABEL[kind].toLowerCase()}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-medium text-zinc-900">{KIND_LABEL_PLURAL[kind]} ({documents.length})</h3>
        {!isOpen && (
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {KIND_ARTICLE_NEW[kind]}
          </button>
        )}
      </div>

      {documents.length > 0 && (
        <DataTable columns={columns} data={documents} emptyMessage={`Aucun ${KIND_LABEL[kind].toLowerCase()}.`} />
      )}

      {isOpen && (
        <form onSubmit={handleUpload} className="card space-y-4 p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Fournisseur *</label>
              <EntityCombobox
                name="__supplierId_combobox"
                options={suppliers as ComboboxOption[]}
                defaultValue={supplierId}
                placeholder="— Choisir un fournisseur —"
                required
                onChange={(id) => {
                  setSupplierId(id);
                  setMarcheId('');
                }}
                createLabel="+ Créer un fournisseur"
                createAction={createSupplierAction}
                createFields={['companyName', 'firstName', 'lastName', 'email', 'phone']}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Marché (optionnel)</label>
              <EntityCombobox
                name="__marcheId_combobox"
                options={marcheOptionsForCombobox as ComboboxOption[]}
                defaultValue={marcheId}
                placeholder={marcheOptionsForCombobox.length === 0 ? '— Aucun marché —' : '— Choisir un marché —'}
                disabled={marcheOptionsForCombobox.length === 0 && !createMarcheAction}
                onChange={(id) => setMarcheId(id)}
              />
              {marcheOptionsForCombobox.length === 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">Aucun marché disponible.</p>
              )}
              {createMarcheAction && (
                <MarcheInlineCreator
                  supplierId={supplierId}
                  properties={properties}
                  createAction={createMarcheAction}
                  onCreated={({ id, label }) => {
                    setMarches((prev) => [
                      { id, label, supplierId: supplierId },
                      ...prev.filter((m) => m.id !== id),
                    ]);
                    setMarcheId(id);
                  }}
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Fichier *</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-[13px]"
            />
            {file && <p className="mt-1 text-[11px] text-zinc-500">{file.name} ({Math.round(file.size / 1024)} KB)</p>}
          </div>

          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Nom *</label>
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              required
              className="input mt-1"
              placeholder={`${KIND_LABEL[kind]} ${KIND_LABEL[kind].toLowerCase() === 'devis' ? 'plomberie' : 'fournisseur'} 2026`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Date</label>
              <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} className="input mt-1" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Montant HT (€)</label>
              <input type="number" step="0.01" min="0" value={amountHt} onChange={(e) => setAmountHt(e.target.value)} className="input mt-1 tabular-nums" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Montant TTC (€)</label>
              <input type="number" step="0.01" min="0" value={amountTtc} onChange={(e) => setAmountTtc(e.target.value)} className="input mt-1 tabular-nums" />
            </div>
          </div>

          {/* V1.10 §4 §5 — liens parents conditionnels par kind */}
          {kind !== 'devis' && (
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
          {kind === 'facture' && (
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
            <button type="button" onClick={reset} disabled={uploading} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Upload…</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" /> Enregistrer</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

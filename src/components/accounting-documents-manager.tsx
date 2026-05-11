'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Loader2, Plus, Trash2, Upload, UploadCloud } from 'lucide-react';
import { DataTable } from './data-table';
import { formatDate } from '@/lib/utils';

export type AccountingDocKind = 'devis' | 'commande' | 'facture';

const KIND_LABEL: Record<AccountingDocKind, string> = {
  devis: 'Devis',
  commande: 'Commande',
  facture: 'Facture',
};

interface AccountingRow {
  id: string;
  supplierLabel: string;
  marcheLabel: string | null;
  name: string;
  storageKey: string;
  documentDate: string | null;
  amountHt: string | null;
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
}

export function AccountingDocumentsManager({
  kind,
  companyId,
  companySlug,
  documents,
  suppliers,
  marches,
  uploadAction,
  deleteAction,
  getUrlAction,
}: Props) {
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // Marchés filtrés par fournisseur sélectionné (optionnel — laisser vide si
  // pas de marché lié)
  const marchesForSupplier = useMemo(() => {
    if (!supplierId) return [];
    return marches
      .filter((m) => m.supplierId === supplierId)
      .map((m) => ({ id: m.id, label: m.label }));
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
      if (documentDate) fd.set('documentDate', documentDate);
      if (amountHt) fd.set('amountHt', amountHt);
      if (amountTtc) fd.set('amountTtc', amountTtc);
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
        header: 'Date',
        sortingFn: 'datetime',
        cell: ({ row }) => (
          <span className="tnum text-[12px] text-zinc-700">{formatDate(row.original.documentDate)}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Document',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => handleDownload(row.original.storageKey)}
            disabled={pendingTransition}
            className="link-cell text-left disabled:opacity-50"
          >
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: 'amountHt',
        header: 'HT',
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-[13px]">
            {row.original.amountHt ? `${Number(row.original.amountHt).toLocaleString('fr-FR')} €` : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableColumnFilter: false,
        size: 80,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
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
    [pendingTransition]
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
        <h3 className="text-[14px] font-medium text-zinc-900">{KIND_LABEL[kind]}s ({documents.length})</h3>
        {!isOpen && (
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nouveau {KIND_LABEL[kind].toLowerCase()}
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
              <select
                value={supplierId}
                onChange={(e) => { setSupplierId(e.target.value); setMarcheId(''); }}
                className="input mt-1"
                required
              >
                <option value="">— Choisir —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Marché (optionnel)</label>
              <select
                value={marcheId}
                onChange={(e) => setMarcheId(e.target.value)}
                disabled={!supplierId || marchesForSupplier.length === 0}
                className="input mt-1"
              >
                <option value="">— Aucun —</option>
                {marchesForSupplier.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              {supplierId && marchesForSupplier.length === 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">Aucun marché pour ce fournisseur.</p>
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
              placeholder={`${KIND_LABEL[kind]} fournisseur 2026`}
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

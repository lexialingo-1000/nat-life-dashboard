'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import {
  deleteAccountingDocAction,
  getAccountingDocUrlAction,
  uploadAccountingDocAction,
} from '@/app/(dashboard)/societes/accounting-actions';

type Kind = 'devis' | 'commande' | 'facture';

const KIND_LABEL: Record<Kind, string> = {
  devis: 'Devis',
  commande: 'Commande',
  facture: 'Facture',
};

const KIND_LABEL_NEW: Record<Kind, string> = {
  devis: 'Nouveau devis',
  commande: 'Nouvelle commande',
  facture: 'Nouvelle facture',
};

const KIND_BADGE: Record<Kind, string> = {
  devis: 'bg-zinc-100 text-zinc-700',
  commande: 'bg-blue-100 text-blue-700',
  facture: 'bg-emerald-100 text-emerald-700',
};

export interface MarcheComptaRow {
  id: string;
  kind: Kind;
  name: string;
  originalFilename: string | null;
  storageKey: string;
  documentDate: string | null;
  amountHt: string | null;
  amountTtc: string | null;
  companyId: string;
  companyName: string;
  supplierId: string;
  supplierLabel: string;
}

interface CompanyOption {
  id: string;
  label: string;
  slug: string;
}

interface SupplierOption {
  id: string;
  label: string;
}

export interface ParentDocOption {
  id: string;
  label: string;
  companyId: string;
  supplierId: string;
}

interface Props {
  rows: MarcheComptaRow[];
  totalHt: number;
  totalTtc: number;
  // V1.10 ext — bouton "+ Nouveau document" sur onglet compta marché
  marcheId: string;
  marcheDefaultSupplierId: string | null;
  marcheDefaultCompanyId: string | null;
  companies: CompanyOption[];
  suppliers: SupplierOption[];
  devisOptions?: ParentDocOption[];
  commandeOptions?: ParentDocOption[];
}

export function MarcheComptaTable({
  rows,
  totalHt,
  totalTtc,
  marcheId,
  marcheDefaultSupplierId,
  marcheDefaultCompanyId,
  companies,
  suppliers,
  devisOptions = [],
  commandeOptions = [],
}: Props) {
  const [pending, startTransition] = useTransition();
  const [uploadKind, setUploadKind] = useState<Kind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState(marcheDefaultCompanyId ?? '');
  const [supplierId, setSupplierId] = useState(marcheDefaultSupplierId ?? '');
  const [docName, setDocName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [amountHt, setAmountHt] = useState('');
  const [amountTtc, setAmountTtc] = useState('');
  const [notes, setNotes] = useState('');
  const [parentDevisId, setParentDevisId] = useState('');
  const [parentCommandeId, setParentCommandeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId]
  );

  const visibleDevis = useMemo(
    () => devisOptions.filter((d) => !supplierId || d.supplierId === supplierId),
    [devisOptions, supplierId]
  );
  const visibleCommandes = useMemo(
    () => commandeOptions.filter((c) => !supplierId || c.supplierId === supplierId),
    [commandeOptions, supplierId]
  );

  const resetForm = () => {
    setUploadKind(null);
    setFile(null);
    setCompanyId(marcheDefaultCompanyId ?? '');
    setSupplierId(marcheDefaultSupplierId ?? '');
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

  const handleDownload = (storageKey: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('storageKey', storageKey);
      const res = await getAccountingDocUrlAction(fd);
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

  const handleDelete = (row: MarcheComptaRow) => {
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
      await deleteAccountingDocAction(fd);
    });
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!uploadKind) return;
    if (!file) { setError('Choisis un fichier'); return; }
    if (!companyId) { setError('Société émettrice obligatoire'); return; }
    if (!supplierId) { setError('Fournisseur obligatoire'); return; }
    if (!docName.trim()) { setError('Nom requis'); return; }
    if (!selectedCompany) { setError('Société invalide'); return; }

    setUploading(true);
    setError(null);

    try {
      // 1) presigned URL via /api/upload (scope=companies + parentSlug)
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
      fd.set('marcheId', marcheId);  // pré-rempli marché courant
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
      await uploadAccountingDocAction(fd);

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
      setUploading(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] text-zinc-500">
          {rows.length} document{rows.length > 1 ? 's' : ''} compta
          {rows.length > 0 ? (rows.length > 1 ? ' liés' : ' lié') : ' lié'} à ce marché.
        </p>
        {rows.length > 0 && (
          <div className="flex flex-col items-end gap-0.5 font-mono text-[12px] tabular-nums text-zinc-700">
            <span>Total HT : {totalHt.toLocaleString('fr-FR')} €</span>
            <span className="font-medium text-zinc-900">
              Total TTC : {totalTtc.toLocaleString('fr-FR')} €
            </span>
          </div>
        )}
      </div>

      {/* V1.10 ext — 3 boutons création kind */}
      {!uploadKind && (
        <div className="flex flex-wrap gap-2">
          {(['devis', 'commande', 'facture'] as Kind[]).map((k) => (
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
        <form onSubmit={handleUpload} className="rounded-md border border-zinc-200 bg-zinc-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[14px] font-medium text-zinc-900">
              {KIND_LABEL_NEW[uploadKind]} — lié à ce marché
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Société émettrice *</label>
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
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Fournisseur *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
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
              placeholder={`${KIND_LABEL[uploadKind]} ${uploadKind === 'devis' ? 'travaux' : 'fournisseur'} 2026`}
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

          {/* V1.10 §4 §5 — liens parents conditionnels */}
          {uploadKind !== 'devis' && (
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Devis lié (optionnel)</label>
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
                <p className="mt-1 text-[11px] text-zinc-500">Aucun devis disponible pour ce fournisseur sur ce marché.</p>
              )}
            </div>
          )}
          {uploadKind === 'facture' && (
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Commande liée (optionnel)</label>
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
                <p className="mt-1 text-[11px] text-zinc-500">Aucune commande disponible pour ce fournisseur sur ce marché.</p>
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
            <button type="button" onClick={resetForm} disabled={uploading} className="btn-secondary">
              Annuler
            </button>
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

      {rows.length === 0 ? (
        <p className="text-[13px] text-zinc-500">
          Aucun devis / commande / facture rattaché à ce marché. Utilise les boutons ci-dessus pour en ajouter.
        </p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Type</th>
              <th>Société</th>
              <th>Fournisseur</th>
              <th>Date document</th>
              <th>Document</th>
              <th className="text-right">HT</th>
              <th className="text-right">TTC</th>
              <th className="text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const fileLabel = d.originalFilename ?? d.name;
              return (
                <tr key={d.id}>
                  <td>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${KIND_BADGE[d.kind] ?? ''}`}
                    >
                      {KIND_LABEL[d.kind] ?? d.kind}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/societes/${d.companyId}`}
                      className="link-cell-soft text-[12px]"
                    >
                      {d.companyName}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={`/fournisseurs/${d.supplierId}`}
                      className="link-cell-soft text-[12px]"
                    >
                      {d.supplierLabel}
                    </Link>
                  </td>
                  <td className="font-mono text-[12px] tabular-nums text-zinc-700">
                    {d.documentDate ?? '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDownload(d.storageKey)}
                      disabled={pending}
                      className="link-cell text-left text-[13px] text-zinc-900 disabled:opacity-50"
                      title={d.name}
                    >
                      {fileLabel}
                    </button>
                  </td>
                  <td className="text-right font-mono tabular-nums text-zinc-500">
                    {d.amountHt ? `${Number(d.amountHt).toLocaleString('fr-FR')} €` : '—'}
                  </td>
                  <td className="text-right font-mono tabular-nums font-medium">
                    {d.amountTtc ? `${Number(d.amountTtc).toLocaleString('fr-FR')} €` : '—'}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/societes/${d.companyId}/compta/${d.id}/edit`}
                        title="Modifier"
                        className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDownload(d.storageKey)}
                        disabled={pending}
                        title="Télécharger"
                        className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(d)}
                        disabled={pending}
                        title="Supprimer"
                        className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

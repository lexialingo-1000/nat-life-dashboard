'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Save, Upload, Loader2 } from 'lucide-react';
import { updateAccountingDocAction } from '@/app/(dashboard)/societes/accounting-actions';

const KIND_OPTIONS = [
  { value: 'devis', label: 'Devis' },
  { value: 'commande', label: 'Commande' },
  { value: 'facture', label: 'Facture' },
] as const;

type Kind = (typeof KIND_OPTIONS)[number]['value'];

interface SupplierOpt {
  id: string;
  label: string;
}

export interface MarcheOpt {
  id: string;
  label: string;
  supplierId: string;
}

export interface ParentDocOpt {
  id: string;
  label: string;
  supplierId: string;
  marcheId: string | null;
}

interface Props {
  doc: {
    id: string;
    companyId: string;
    companySlug: string;
    supplierId: string;
    marcheId: string | null;
    kind: Kind;
    name: string;
    storageKey: string;
    originalFilename: string | null;
    documentDate: string | null;
    amountHt: string | null;
    amountTtc: string | null;
    parentDevisId: string | null;
    parentCommandeId: string | null;
    notes: string | null;
  };
  suppliers: SupplierOpt[];
  marches: MarcheOpt[];
  devisOptions: ParentDocOpt[];
  commandeOptions: ParentDocOpt[];
  returnTo: string;
}

export function ComptaEditForm({
  doc,
  suppliers,
  marches,
  devisOptions,
  commandeOptions,
  returnTo,
}: Props) {
  const [kind, setKind] = useState<Kind>(doc.kind);
  const [supplierId, setSupplierId] = useState(doc.supplierId);
  const [marcheId, setMarcheId] = useState(doc.marcheId ?? '');
  const [parentDevisId, setParentDevisId] = useState(doc.parentDevisId ?? '');
  const [parentCommandeId, setParentCommandeId] = useState(doc.parentCommandeId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStorageKey, setNewStorageKey] = useState<string>('');
  const [newOriginalFilename, setNewOriginalFilename] = useState<string>('');

  // V1.10 §2 — marchés filtrés par fournisseur sélectionné.
  const marchesForSupplier = useMemo(
    () => marches.filter((m) => m.supplierId === supplierId),
    [marches, supplierId],
  );

  // V1.10 §4 §5 — devis disponibles si kind=commande/facture, commandes si kind=facture.
  // Filtre par même fournisseur que le doc courant pour éviter d'afficher 500 docs.
  const visibleDevis = useMemo(
    () =>
      devisOptions
        .filter((d) => d.supplierId === supplierId)
        .filter((d) => !marcheId || !d.marcheId || d.marcheId === marcheId)
        .filter((d) => d.id !== doc.id),
    [devisOptions, supplierId, marcheId, doc.id],
  );
  const visibleCommandes = useMemo(
    () =>
      commandeOptions
        .filter((c) => c.supplierId === supplierId)
        .filter((c) => !marcheId || !c.marcheId || c.marcheId === marcheId)
        .filter((c) => c.id !== doc.id),
    [commandeOptions, supplierId, marcheId, doc.id],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      setNewStorageKey('');
      setNewOriginalFilename('');
      return;
    }
    setFile(f);
    setUploading(true);
    setError(null);
    try {
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'companies',
          parentSlug: doc.companySlug,
          parentId: doc.companyId,
          fileName: f.name,
        }),
      });
      if (!presignRes.ok) {
        const errBody = await presignRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? 'Erreur presign');
      }
      const { uploadUrl, storageKey } = await presignRes.json();

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: f,
        headers: { 'Content-Type': f.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error('Upload MinIO échoué');

      setNewStorageKey(storageKey);
      setNewOriginalFilename(f.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
      setFile(null);
      setNewStorageKey('');
      setNewOriginalFilename('');
    } finally {
      setUploading(false);
    }
  };

  const filenameLabel = doc.originalFilename ?? doc.name;

  return (
    <form action={updateAccountingDocAction} className="card space-y-5 p-6" autoComplete="off">
      <input type="hidden" name="id" value={doc.id} />
      <input type="hidden" name="companyId" value={doc.companyId} />
      <input type="hidden" name="newStorageKey" value={newStorageKey} />
      <input type="hidden" name="newOriginalFilename" value={newOriginalFilename} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Type *</label>
          <select
            name="kind"
            value={kind}
            onChange={(e) => {
              const v = e.target.value as Kind;
              setKind(v);
              if (v === 'devis') {
                setParentDevisId('');
                setParentCommandeId('');
              } else if (v === 'commande') {
                setParentCommandeId('');
              }
            }}
            required
            className="input mt-1"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Date document</label>
          <input
            type="date"
            name="documentDate"
            defaultValue={doc.documentDate ?? ''}
            className="input mt-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Nom *</label>
        <input
          name="name"
          defaultValue={doc.name}
          required
          className="input mt-1"
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Fournisseur *</label>
          <select
            name="supplierId"
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setMarcheId('');
              setParentDevisId('');
              setParentCommandeId('');
            }}
            required
            className="input mt-1"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Marché (optionnel)</label>
          <select
            name="marcheId"
            value={marcheId}
            onChange={(e) => {
              setMarcheId(e.target.value);
              setParentDevisId('');
              setParentCommandeId('');
            }}
            className="input mt-1"
          >
            <option value="">— Aucun marché —</option>
            {marchesForSupplier.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {marchesForSupplier.length === 0 && supplierId && (
            <p className="mt-1 text-[11px] text-zinc-500">Aucun marché lié à ce fournisseur.</p>
          )}
        </div>
      </div>

      {/* V1.10 §4 §5 — liens parents conditionnels */}
      {kind !== 'devis' && (
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">
            Devis lié (optionnel)
          </label>
          <select
            name="parentDevisId"
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
              Aucun devis existant pour ce fournisseur.
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
            name="parentCommandeId"
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
              Aucune commande existante pour ce fournisseur.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Montant HT (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amountHt"
            defaultValue={doc.amountHt ?? ''}
            className="input tnum mt-1"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Montant TTC (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amountTtc"
            defaultValue={doc.amountTtc ?? ''}
            className="input tnum mt-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={doc.notes ?? ''}
          className="input mt-1"
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
        />
      </div>

      {/* V1.10 §1 — bloc Pièce jointe (remplacement optionnel) */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <label className="block text-[12px] font-medium text-zinc-700">Pièce jointe</label>
        <p className="mt-1 text-[12px] text-zinc-600">
          Fichier actuel : <span className="font-mono text-zinc-800">{filenameLabel}</span>
        </p>
        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-[0.04em] text-zinc-500">
            Remplacer par
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            className="mt-1 block w-full text-[12px] text-zinc-700 file:mr-3 file:rounded-sm file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-zinc-700"
          />
        </div>
        {uploading && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-zinc-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Upload en cours…
          </p>
        )}
        {newStorageKey && !uploading && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-emerald-700">
            <Upload className="h-3.5 w-3.5" />
            Nouveau fichier prêt : <span className="font-mono">{file?.name}</span>. Cliquer
            Enregistrer pour confirmer.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={returnTo} className="btn-secondary">
          Annuler
        </Link>
        <button type="submit" className="btn-primary" disabled={uploading}>
          <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Enregistrer
        </button>
      </div>
    </form>
  );
}

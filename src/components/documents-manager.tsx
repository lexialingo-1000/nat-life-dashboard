'use client';

import { useMemo, useState, useTransition } from 'react';
import { Download, Loader2, Pencil, Plus, Trash2, Upload, UploadCloud } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from './data-table';
import { formatDate } from '@/lib/utils';

const SCOPE_SINGULAR: Record<string, string> = {
  companies: 'company',
  suppliers: 'supplier',
  customers: 'customer',
  properties: 'property',
  lots: 'lot',
  marches: 'marche',
  locations: 'location',
};

type DocumentCategory =
  | 'notaire'
  | 'banque'
  | 'juridique'
  | 'comptabilite'
  | 'courant'
  | 'location';

// V1.11 R9 — labels rendus dynamiques via prop `categoriesMap` fourni par chaque
// callsite (fetché depuis la table `document_categories`). Le fallback ci-dessous
// sert quand la page n'a pas pré-fetché la map (callsites pas encore migrés).
const FALLBACK_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  notaire: 'Notaire',
  banque: 'Banque',
  juridique: 'Juridique',
  comptabilite: 'Comptabilité',
  courant: 'Courant',
  location: 'Location',
};

const CATEGORY_BADGE: Record<DocumentCategory, string> = {
  notaire: 'badge-blue',
  banque: 'badge-emerald',
  juridique: 'badge-amber',
  comptabilite: 'badge-blue',
  courant: 'badge-neutral',
  location: 'badge-emerald',
};

const CATEGORY_ORDER: DocumentCategory[] = [
  'notaire',
  'banque',
  'juridique',
  'comptabilite',
  'courant',
  'location',
];

type DocumentRow = {
  id: string;
  name: string;
  typeLabel: string;
  /** V1.9 Lot E — null si pas encore catégorisé. Optional pour compat call sites. */
  category?: DocumentCategory | null;
  storageKey: string;
  documentDate: string | null;
  expiresAt: string | null;
  uploadedAt: string;
};

type DocumentType = {
  id: string;
  label: string;
  hasExpiration: boolean;
  category?: DocumentCategory | null;
};

type ServerAction<R = void> = (formData: FormData) => Promise<R>;

interface Props {
  scope:
    | 'companies'
    | 'suppliers'
    | 'customers'
    | 'properties'
    | 'lots'
    | 'marches'
    | 'locations';
  parentId: string;
  parentSlug: string;
  parentIdFieldName: string;
  documents: DocumentRow[];
  availableTypes: DocumentType[];
  uploadAction: ServerAction;
  deleteAction: ServerAction;
  getUrlAction: ServerAction<{ url: string } | { error: string }>;
  /** V1.11 R9 — map dynamique label par code, lue depuis `document_categories`.
   * Si fournie, override le fallback hardcodé pour refléter les renames admin. */
  categoriesMap?: Partial<Record<DocumentCategory, string>>;
}

function expirationLabel(expiresAt: string | null) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  const now = new Date();
  const days = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: 'Expiré', color: 'red' as const };
  if (days < 30) return { text: `Expire dans ${days}j`, color: 'orange' as const };
  return { text: `Valide`, color: 'green' as const };
}

export function DocumentsManager({
  scope,
  parentId,
  parentSlug,
  parentIdFieldName,
  documents,
  availableTypes,
  uploadAction,
  deleteAction,
  getUrlAction,
  categoriesMap,
}: Props) {
  // V1.11 R9 — résolution label : map dynamique (renames admin) puis fallback.
  const labelFor = (code: DocumentCategory): string =>
    categoriesMap?.[code] ?? FALLBACK_CATEGORY_LABELS[code];
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState('');
  const [docName, setDocName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingTransition, startTransition] = useTransition();

  const selectedType = availableTypes.find((t) => t.id === typeId);

  // V11 §U3 — pré-remplissage automatique de la catégorie : si le type sélectionné
  // a une catégorie par défaut configurée côté admin, on l'applique tant que
  // l'utilisateur n'a pas explicitement choisi autre chose. Reste éditable.
  const handleTypeChange = (newTypeId: string) => {
    setTypeId(newTypeId);
    const t = availableTypes.find((x) => x.id === newTypeId);
    if (t?.category && !category) setCategory(t.category);
  };

  const reset = () => {
    setFile(null);
    setTypeId('');
    setDocName('');
    setDocumentDate('');
    setExpiresAt('');
    setCategory('');
    setShowForm(false);
    setError(null);
  };

  const acceptDroppedFile = (dropped: File) => {
    setFile(dropped);
    if (!docName) setDocName(dropped.name.replace(/\.[^.]+$/, ''));
    setShowForm(true);
    setError(null);
    if (!typeId && availableTypes.length === 1) setTypeId(availableTypes[0].id);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (availableTypes.length === 0) {
      setError(
        'Aucun type de document configuré pour ce scope. Ajoute-en via la page « Types de documents ».'
      );
      return;
    }
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptDroppedFile(dropped);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!file || !typeId || !docName.trim()) {
      setError('Fichier, type et nom sont obligatoires');
      return;
    }

    setUploading(true);
    try {
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          parentSlug,
          parentId,
          fileName: file.name,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur upload (${presignRes.status})`);
      }

      const { uploadUrl, storageKey } = (await presignRes.json()) as {
        uploadUrl: string;
        storageKey: string;
      };

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      if (!putRes.ok) {
        throw new Error(`Upload MinIO échoué (${putRes.status})`);
      }

      const fd = new FormData();
      fd.set(parentIdFieldName, parentId);
      fd.set('typeId', typeId);
      fd.set('name', docName.trim());
      fd.set('storageKey', storageKey);
      if (documentDate) fd.set('documentDate', documentDate);
      if (expiresAt) fd.set('expiresAt', expiresAt);
      if (category) fd.set('category', category);

      await uploadAction(fd);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (storageKey: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('storageKey', storageKey);
      const res = await getUrlAction(fd);
      if ('url' in res) {
        // V1.10 J — window.open() bloqué par popup-blocker des navigateurs quand
        // appelé après un await (clic utilisateur "expiré"). Cliente Natacha
        // rapportait : "Document/doc ne telecharge pas" sur fiche marché.
        // Création dynamique d'un <a> + .click() programmatique : le navigateur
        // accepte car l'action descend du même clic utilisateur via la transition.
        const a = document.createElement('a');
        a.href = res.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        // download attribute : MinIO presigned URL inclut response-content-disposition,
        // mais on l'override pour compat navigateurs.
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert(`Erreur téléchargement : ${res.error}`);
      }
    });
  };

  const handleDelete = (doc: DocumentRow) => {
    if (!confirm(`Supprimer le document "${doc.name}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('documentId', doc.id);
      fd.set(parentIdFieldName, parentId);
      await deleteAction(fd);
    });
  };

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: 'typeLabel',
        accessorKey: 'typeLabel',
        header: 'Type',
        cell: ({ row }) => <span className="badge-neutral">{row.original.typeLabel}</span>,
      },
      {
        // V11 (Natacha §U3) — colonne dédiée Catégorie sur toutes les listes
        // de documents. Avant V11 elle était fusionnée au Type via un badge
        // à droite. Filtrable et triable de manière indépendante.
        id: 'category',
        accessorKey: 'category',
        header: 'Catégorie',
        cell: ({ row }) =>
          row.original.category ? (
            <span className={CATEGORY_BADGE[row.original.category]}>
              {labelFor(row.original.category)}
            </span>
          ) : (
            <span className="text-[12px] text-zinc-400">—</span>
          ),
        filterFn: (row, _id, value) => {
          const v = row.original.category;
          if (!v) return false;
          return labelFor(v).toLowerCase().startsWith(String(value).toLowerCase());
        },
      },
      {
        id: 'documentDate',
        accessorKey: 'documentDate',
        header: 'Date du document',
        sortingFn: 'datetime',
        cell: ({ row }) => (
          <span className="tnum text-zinc-700">{formatDate(row.original.documentDate)}</span>
        ),
      },
      {
        id: 'uploadedAt',
        accessorKey: 'uploadedAt',
        header: "Date d'intégration",
        sortingFn: 'datetime',
        cell: ({ row }) => (
          <span className="tnum text-zinc-500">{formatDate(row.original.uploadedAt)}</span>
        ),
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Titre du document',
        cell: ({ row }) => {
          const exp = expirationLabel(row.original.expiresAt);
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload(row.original.storageKey)}
                disabled={pendingTransition}
                className="link-cell text-left disabled:opacity-50"
              >
                {row.original.name}
              </button>
              {exp && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    exp.color === 'red'
                      ? 'bg-red-100 text-red-800'
                      : exp.color === 'orange'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {exp.text}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableColumnFilter: false,
        size: 120,
        cell: ({ row }) => {
          const scopeSingular = SCOPE_SINGULAR[scope] ?? scope;
          return (
            <div className="flex items-center justify-end gap-1">
              <Link
                href={`/documents/edit/${scopeSingular}/${row.original.id}`}
                title="Modifier (date, expiration, notes)"
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
          );
        },
      },
    ],
    [pendingTransition, scope]
  );

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ),
    [documents]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative space-y-4 rounded-md transition-colors ${
        isDragging
          ? 'bg-blue-50/40 outline outline-2 outline-dashed outline-blue-500/70'
          : ''
      }`}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md">
          <div className="flex items-center gap-2 rounded-full bg-blue-700/90 px-4 py-1.5 text-[12px] font-medium text-white shadow-sm">
            <UploadCloud className="h-4 w-4" />
            Déposer pour ajouter un document
          </div>
        </div>
      )}

      <div className="rounded-md border border-zinc-100">
        <DataTable
          columns={columns}
          data={sortedDocuments}
          striped={false}
          emptyMessage="Aucun document pour l'instant. Glisse-dépose un fichier ici ou utilise le bouton ci-dessous."
        />
      </div>

      {!showForm && availableTypes.length > 0 && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn-secondary w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un document
          <span className="ml-2 hidden text-[11px] font-normal text-zinc-400 sm:inline">
            (ou glisser-déposer)
          </span>
        </button>
      )}

      {availableTypes.length === 0 && (
        <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-800">
          Aucun type de document configuré pour ce scope. Ajoute-en via la page « Types de
          documents ».
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleUpload}
          className="space-y-3 rounded-md border border-zinc-200 bg-[#fbf8f0] p-4"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700">Type *</label>
            <select
              value={typeId}
              onChange={(e) => handleTypeChange(e.target.value)}
              required
              className="input mt-1"
            >
              <option value="">— Choisir —</option>
              {(() => {
                // Groupe les options par catégorie via <optgroup>. Types sans catégorie
                // tombent dans une section « Sans catégorie » à la fin.
                const grouped = new Map<DocumentCategory | '__none__', typeof availableTypes>();
                for (const t of availableTypes) {
                  const key = t.category ?? '__none__';
                  if (!grouped.has(key)) grouped.set(key, []);
                  grouped.get(key)!.push(t);
                }
                const orderedKeys: (DocumentCategory | '__none__')[] = [
                  ...CATEGORY_ORDER.filter((k) => grouped.has(k)),
                  ...(grouped.has('__none__') ? ['__none__' as const] : []),
                ];
                return orderedKeys.map((key) => (
                  <optgroup
                    key={key}
                    label={key === '__none__' ? 'Sans catégorie' : labelFor(key)}
                  >
                    {grouped.get(key)!.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory | '')}
              className="input mt-1"
            >
              <option value="">— Sans catégorie —</option>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {labelFor(c)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500">
              Pré-remplie selon le type sélectionné si configuré, modifiable.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700">Fichier *</label>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !docName) setDocName(f.name.replace(/\.[^.]+$/, ''));
              }}
              required={!file}
              className="input mt-1 file:mr-3 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-xs"
            />
            {file && (
              <p className="mt-1 text-[11px] text-zinc-500">
                Sélectionné : <span className="font-medium text-zinc-700">{file.name}</span> (
                {Math.round(file.size / 1024)} ko)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700">Nom *</label>
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              required
              className="input mt-1"
              placeholder="Ex: KBis 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Date du document</label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="input mt-1"
              />
            </div>
            {selectedType?.hasExpiration && (
              <div>
                <label className="block text-xs font-medium text-zinc-700">Expire le</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="input mt-1"
                />
              </div>
            )}
          </div>

          {error && <p className="rounded bg-red-50 p-2 text-xs text-red-800">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} disabled={uploading} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upload…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Uploader
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Download, Loader2, Plus, Trash2, Upload } from 'lucide-react';

type DocumentRow = {
  id: string;
  name: string;
  typeLabel: string;
  storageKey: string;
  documentDate: string | null;
  expiresAt: string | null;
};

type DocumentType = {
  id: string;
  label: string;
  hasExpiration: boolean;
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
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState('');
  const [docName, setDocName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  const selectedType = availableTypes.find((t) => t.id === typeId);

  const reset = () => {
    setFile(null);
    setTypeId('');
    setDocName('');
    setDocumentDate('');
    setExpiresAt('');
    setShowForm(false);
    setError(null);
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
        window.open(res.url, '_blank');
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

  const expirationLabel = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const days = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Expiré', color: 'red' };
    if (days < 30) return { text: `Expire dans ${days}j`, color: 'orange' };
    return { text: `Valide jusqu'au ${new Date(expiresAt).toLocaleDateString('fr-FR')}`, color: 'green' };
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {documents.length === 0 && (
          <li className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
            Aucun document pour l'instant.
          </li>
        )}
        {documents.map((d) => {
          const exp = expirationLabel(d.expiresAt);
          return (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{d.name}</div>
                <div className="text-xs text-zinc-500">
                  {d.typeLabel}
                  {d.documentDate &&
                    ` · daté du ${new Date(d.documentDate).toLocaleDateString('fr-FR')}`}
                </div>
              </div>
              {exp && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    exp.color === 'red'
                      ? 'bg-red-100 text-red-800'
                      : exp.color === 'orange'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {exp.text}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDownload(d.storageKey)}
                  disabled={pendingTransition}
                  title="Télécharger"
                  className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(d)}
                  disabled={pendingTransition}
                  title="Supprimer"
                  className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {!showForm && availableTypes.length > 0 && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn-secondary w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un document
        </button>
      )}

      {availableTypes.length === 0 && (
        <p className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">
          Aucun type de document configuré pour ce scope. Ajoute-en via la page « Types de
          documents ».
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleUpload}
          className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700">Type *</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              required
              className="input mt-1"
            >
              <option value="">— Choisir —</option>
              {availableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
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
              required
              className="input mt-1 file:mr-3 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-xs"
            />
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

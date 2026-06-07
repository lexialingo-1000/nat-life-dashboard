'use client';

import { useState, useTransition, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import {
  appendTachePhotoAction,
  deleteTachePhotoAction,
  getTachePhotoUrlAction,
} from '@/app/(dashboard)/marches/actions';

/**
 * V1.14 F-3 — Dialog d'upload + gallery des photos d'une tâche.
 * Source : Remarques client dashboard-18 §"LISTE DE SUIVI DE TACHES DANS
 * FOURNISSEURS" — "possibilité d'uploader des photos pour chaque tache".
 *
 * Flow upload :
 * 1. POST /api/upload → { uploadUrl (presigned), storageKey }
 * 2. PUT direct vers MinIO via uploadUrl
 * 3. Server action appendTachePhotoAction(tacheId, storageKey) → append au photos[]
 *
 * Path MinIO : Marches/tache-photos/{tacheId}/{ts}-{filename}
 */

interface Props {
  tacheId: string;
  tacheTitle: string;
  photos: string[];
  onClose: () => void;
}

export function TachePhotosDialog({ tacheId, tacheTitle, photos: initialPhotos, onClose }: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Fetch presigned URL pour chaque photo (thumbnails)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = { ...previewUrls };
      for (const key of photos) {
        if (next[key]) continue;
        const fd = new FormData();
        fd.set('storageKey', key);
        const res = await getTachePhotoUrlAction(fd);
        if (cancelled) return;
        if ('url' in res) next[key] = res.url;
      }
      if (!cancelled) setPreviewUrls(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`"${file.name}" n'est pas une image.`);
        }

        // 1. demander une presigned URL
        const presigned = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'marches',
            parentSlug: 'tache-photos',
            parentId: tacheId,
            fileName: file.name,
          }),
        });
        if (!presigned.ok) {
          const err = await presigned.json().catch(() => ({ error: 'Erreur upload' }));
          throw new Error(err.error ?? 'Erreur upload');
        }
        const { uploadUrl, storageKey } = (await presigned.json()) as {
          uploadUrl: string;
          storageKey: string;
        };

        // 2. PUT direct vers MinIO
        const put = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!put.ok) throw new Error('Upload MinIO échoué');

        // 3. append au tableau photos[]
        const fd = new FormData();
        fd.set('id', tacheId);
        fd.set('storageKey', storageKey);
        await appendTachePhotoAction(fd);

        setPhotos((prev) => Array.from(new Set([...prev, storageKey])));
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (storageKey: string) => {
    if (!confirm('Supprimer cette photo ?')) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', tacheId);
      fd.set('storageKey', storageKey);
      await deleteTachePhotoAction(fd);
      setPhotos((prev) => prev.filter((p) => p !== storageKey));
    });
  };

  // Render via portal pour éviter les forms imbriqués (pattern V1.9 B1).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-zinc-900">Photos de la tâche</h3>
            <p className="mt-0.5 text-[13px] text-zinc-500">{tacheTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Zone upload */}
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-50/60 p-6 text-center text-[13px] text-zinc-600 transition hover:bg-zinc-50 ${
            isUploading ? 'opacity-50' : ''
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-700" />
              <span>Upload en cours…</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-zinc-400" strokeWidth={1.75} />
              <span>
                <strong className="text-zinc-900">Cliquer pour uploader</strong> ou glisser-déposer
              </span>
              <span className="text-[11px] text-zinc-400">
                JPG / PNG / HEIC — plusieurs fichiers OK
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isUploading}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        {uploadError && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">
            {uploadError}
          </p>
        )}

        {/* Galerie */}
        <div className="mt-4">
          {photos.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-zinc-400">
              Aucune photo pour l'instant.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((key) => (
                <PhotoTile
                  key={key}
                  storageKey={key}
                  url={previewUrls[key]}
                  onDelete={() => handleDelete(key)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PhotoTile({
  storageKey,
  url,
  onDelete,
}: {
  storageKey: string;
  url: string | undefined;
  onDelete: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
      <div className="aspect-square w-full">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a href={url} target="_blank" rel="noreferrer" className="block h-full w-full">
            <img
              src={url}
              alt={storageKey}
              className="h-full w-full object-cover transition group-hover:opacity-90"
            />
          </a>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-zinc-500 opacity-0 shadow-sm transition hover:text-red-600 group-hover:opacity-100"
        title="Supprimer"
        aria-label="Supprimer"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

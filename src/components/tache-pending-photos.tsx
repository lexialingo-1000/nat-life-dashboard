'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { CreateTacheState } from '@/app/(dashboard)/marches/actions';
import { uploadTachePhoto } from '@/components/tache-photos-dialog';

/**
 * Retours 24/11/2026 pt 8-9 — photos (+ commentaire par photo) choisies DANS le form de
 * création d'une tâche. Les fichiers restent dans le navigateur jusqu'à la création :
 * la clé MinIO exige l'id de la tâche (isUploadKeyFor). Flow :
 * 1. le form envoie `hasPhotos=1` → createTacheAction rend `{ status: 'created', id }`
 *    au lieu de rediriger ;
 * 2. `useUploadPendingPhotos` envoie chaque photo via `uploadTachePhoto` (mécanisme du dialog) ;
 * 3. navigation vers `returnTo`. Une photo en échec n'annule pas la tâche : message + lien.
 */

export interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  comment: string;
}

export function TachePendingPhotos({
  photos,
  onChange,
  disabled,
}: {
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const added: PendingPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" n'est pas une image.`);
        continue;
      }
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        comment: '',
      });
    }
    onChange([...photos, ...added]);
  };

  const remove = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.previewUrl);
    onChange(photos.filter((x) => x.id !== id));
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-zinc-700">Photos</label>
      <label
        className={`mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-50/60 p-4 text-[13px] text-zinc-600 transition hover:bg-zinc-50 ${
          disabled ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <ImagePlus className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
        <span>
          <strong className="text-zinc-900">Ajouter des photos</strong> — envoyées à la création de
          la tâche
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {error && <p className="mt-1 text-[11px] text-red-700">{error}</p>}

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-50"
            >
              <div className="aspect-square w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt={p.file.name} className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={disabled}
                className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-zinc-500 shadow-sm transition hover:text-red-600"
                title="Retirer"
                aria-label="Retirer la photo"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <textarea
                value={p.comment}
                onChange={(e) =>
                  onChange(
                    photos.map((x) => (x.id === p.id ? { ...x, comment: e.target.value } : x)),
                  )
                }
                disabled={disabled}
                rows={2}
                maxLength={1000}
                placeholder="Commentaire (facultatif)"
                aria-label={`Commentaire de la photo ${p.file.name}`}
                className="block w-full resize-none border-0 border-t border-zinc-200 bg-white px-2 py-1.5 text-[12px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-600"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Après `createTacheAction` → `{ status: 'created' }` : envoie les photos en attente puis
 * navigue vers `returnTo`. Renvoie l'état d'envoi pour l'affichage.
 */
export function useUploadPendingPhotos(state: CreateTacheState, photos: PendingPhoto[]) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState<{ message: string; returnTo: string } | null>(null);
  const createdId = state.status === 'created' ? state.id : null;

  useEffect(() => {
    if (state.status !== 'created') return;
    const { id, returnTo } = state;
    let cancelled = false;
    setUploading(true);
    (async () => {
      const errors: string[] = [];
      for (const p of photos) {
        try {
          await uploadTachePhoto(id, p.file, p.comment);
        } catch (e) {
          errors.push(`${p.file.name} : ${e instanceof Error ? e.message : 'erreur'}`);
        }
      }
      if (cancelled) return;
      setUploading(false);
      if (errors.length > 0) {
        setFailure({
          message: `Tâche créée, mais ${errors.length} photo(s) non envoyée(s) (${errors.join(' · ')}). Ajoute-les depuis la tâche (icône photo).`,
          returnTo,
        });
        return;
      }
      router.push(returnTo);
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
    // Un seul envoi par tâche créée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdId]);

  return { uploading, failure, created: createdId !== null };
}

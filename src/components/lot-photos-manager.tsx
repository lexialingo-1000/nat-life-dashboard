'use client';

// Cloné de property-photos-manager.tsx (V1.9 D2). Diff : scope='lots' au
// lieu de 'properties' + champ form `lotId` au lieu de `propertyId`.

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, Trash2, X, ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';

interface PhotoItem {
  id: string;
  name: string;
  storageKey: string;
  uploadedAt: string;
}

interface Props {
  lotId: string;
  lotSlug: string;
  photos: PhotoItem[];
  photoTypeId: string | null;
  uploadAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  getUrlAction: (formData: FormData) => Promise<{ url: string } | { error: string }>;
}

export function LotPhotosManager({
  lotId,
  lotSlug,
  photos,
  photoTypeId,
  uploadAction,
  deleteAction,
  getUrlAction,
}: Props) {
  const router = useRouter();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    for (const photo of photos) {
      if (urls[photo.id]) continue;
      const fd = new FormData();
      fd.set('storageKey', photo.storageKey);
      getUrlAction(fd).then((res) => {
        if ('url' in res) {
          setUrls((prev) => ({ ...prev, [photo.id]: res.url }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const openLightbox = (i: number) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPhoto = () =>
    setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'ArrowRight') nextPhoto();
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !photoTypeId) return;
    setUploadError(null);
    setUploading(true);

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'lots',
            parentSlug: lotSlug,
            parentId: lotId,
            fileName: file.name,
          }),
        });
        if (!res.ok) throw new Error('Erreur obtention URL upload');
        const { uploadUrl, storageKey } = await res.json();

        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

        const fd = new FormData();
        fd.set('lotId', lotId);
        fd.set('typeId', photoTypeId);
        fd.set('name', file.name);
        fd.set('storageKey', storageKey);
        await uploadAction(fd);
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Erreur upload');
      }
    }
    setUploading(false);
    router.refresh();
  };

  if (!photoTypeId) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 p-8 text-center text-[13px] text-zinc-500">
        <ImageIcon className="mx-auto mb-3 h-8 w-8 text-zinc-300" strokeWidth={1.5} />
        Type de document "Photo" non configuré pour les lots.{' '}
        <a href="/admin/types-documents" className="text-blue-700 hover:underline">
          Ajouter le type via l'administration.
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div
        className={`relative rounded-md border-2 border-dashed p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-zinc-200 bg-[#fbf8f0] hover:border-zinc-300'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); uploadFiles(e.dataTransfer.files); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-[13px] text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Upload en cours…
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-2 h-6 w-6 text-zinc-400" strokeWidth={1.75} />
            <p className="text-[13px] text-zinc-500">
              Glisse des photos ici ou{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-700 hover:underline"
              >
                sélectionne des fichiers
              </button>
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">JPG, PNG, WEBP, HEIC acceptés</p>
          </>
        )}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-blue-50/80">
            <span className="rounded-full bg-blue-600 px-4 py-1.5 text-[12px] font-medium text-white shadow">
              Déposer pour ajouter
            </span>
          </div>
        )}
      </div>

      {uploadError && (
        <p className="text-[12px] text-red-600">{uploadError}</p>
      )}

      {photos.length === 0 ? (
        <p className="text-center text-[13px] text-zinc-400">
          Aucune photo pour l'instant.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
            >
              {urls[photo.id] ? (
                <img
                  src={urls[photo.id]}
                  alt={photo.name}
                  className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105"
                  onClick={() => openLightbox(i)}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-300" strokeWidth={2} />
                </div>
              )}
              <div className="absolute inset-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                {/* V1.11 L — bouton download photo (cliente : "On doit pouvoir
                    retelecharger en local une photo qui a été uploadée"). */}
                <button
                  type="button"
                  title="Télécharger cette photo"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const fd = new FormData();
                    fd.set('storageKey', photo.storageKey);
                    const res = await getUrlAction(fd);
                    if (!('url' in res)) {
                      alert(`Erreur : ${res.error}`);
                      return;
                    }
                    const a = document.createElement('a');
                    a.href = res.url;
                    a.download = photo.name;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="rounded-full bg-white/90 p-1.5 text-blue-700 shadow hover:bg-white"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  title="Supprimer cette photo"
                  onClick={async () => {
                    if (!confirm(`Supprimer "${photo.name}" ?`)) return;
                    const fd = new FormData();
                    fd.set('documentId', photo.id);
                    fd.set('lotId', lotId);
                    try {
                      await deleteAction(fd);
                      router.refresh();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Erreur suppression');
                    }
                  }}
                  className="rounded-full bg-white/90 p-1.5 text-red-600 shadow hover:bg-white"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
          onClick={closeLightbox}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={closeLightbox}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
          )}
          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2} />
            </button>
          )}

          <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {urls[photos[lightboxIndex].id] ? (
              <img
                src={urls[photos[lightboxIndex].id]}
                alt={photos[lightboxIndex].name}
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" strokeWidth={2} />
              </div>
            )}
            <p className="mt-2 text-center text-[12px] text-white/60">
              {photos[lightboxIndex].name} · {lightboxIndex + 1}/{photos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

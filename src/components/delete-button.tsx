'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteButtonProps {
  /** Server action that takes FormData and deletes the resource. */
  action: (formData: FormData) => Promise<void>;
  /** Hidden id passed to the action. */
  id: string;
  /** Label shown on the button (button variant) or as tooltip (icon variant). */
  label?: string;
  /** Confirmation phrase the user must type. */
  confirmationPhrase: string;
  /** Description shown in the modal. */
  description: string;
  /** Extra hidden fields passed to the action (e.g. returnTo, lotId). */
  extraFields?: Record<string, string>;
  /** 'button' (default) renders the full bordered red button. 'icon' renders a compact red trash icon button. */
  variant?: 'button' | 'icon';
}

export function DeleteButton({
  action,
  id,
  label = 'Supprimer',
  confirmationPhrase,
  description,
  extraFields,
  variant = 'button',
}: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Comparaison tolérante : casse, accents, espaces multiples (V11 Natacha :
  // "le bouton ne passe pas en rouge"). Certains noms en DB ont un double-espace
  // ou la cliente tape en minuscules — on normalise les deux côtés.
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const canConfirm = normalize(typed) === normalize(confirmationPhrase);

  const handleConfirm = () => {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('id', id);
        if (extraFields) {
          for (const [k, v] of Object.entries(extraFields)) fd.set(k, v);
        }
        await action(fd);
      } catch (err) {
        // Next.js redirect() throws NEXT_REDIRECT — let it propagate so navigation happens.
        if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest?: unknown }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : 'Erreur inconnue lors de la suppression';
        setError(msg);
      }
    });
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={label}
          aria-label={label}
          className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-[#fbf8f0] px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          {label}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-[#fbf8f0] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">Confirmer la suppression</h2>
            <p className="mt-2 text-sm text-zinc-600">{description}</p>

            <div className="mt-4">
              <label className="block text-sm text-zinc-700">
                Tape <span className="font-mono text-red-600">{confirmationPhrase}</span> pour confirmer
              </label>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="input mt-1"
                placeholder={confirmationPhrase}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTyped('');
                  setError(null);
                }}
                disabled={pending}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm || pending}
                className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer définitivement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

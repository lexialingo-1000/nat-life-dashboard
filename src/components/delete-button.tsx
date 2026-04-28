'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteButtonProps {
  /** Server action that takes FormData and deletes the resource. */
  action: (formData: FormData) => Promise<void>;
  /** Hidden id passed to the action. */
  id: string;
  /** Label shown on the button. */
  label?: string;
  /** Confirmation phrase the user must type. */
  confirmationPhrase: string;
  /** Description shown in the modal. */
  description: string;
}

export function DeleteButton({
  action,
  id,
  label = 'Supprimer',
  confirmationPhrase,
  description,
}: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();

  const canConfirm = typed === confirmationPhrase;

  const handleConfirm = () => {
    if (!canConfirm) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await action(fd);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-[#fbf8f0] px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        {label}
      </button>

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

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTyped('');
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

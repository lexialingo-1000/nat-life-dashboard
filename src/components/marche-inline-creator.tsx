'use client';

import { useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';

interface PropertyOption {
  id: string;
  label: string;
}

type CreateResult = { id: string; label: string } | { error: string };

interface Props {
  /** Fournisseur déjà sélectionné dans le combobox parent (requis). */
  supplierId: string;
  /** Propriétés (biens) éligibles pour rattacher ce marché (filtrées société courante). */
  properties: PropertyOption[];
  /** Action serveur de création inline. */
  createAction: (formData: FormData) => Promise<CreateResult>;
  /** Callback quand la création réussit — typiquement pour ajouter l'option au combobox parent. */
  onCreated: (marche: { id: string; label: string }) => void;
  /** Désactivé tant que pas de supplier sélectionné. */
  disabled?: boolean;
}

/**
 * V12bis umbrella §2 — création inline d'un marché depuis le form upload doc compta.
 * Bouton "+ Créer marché" → dialog (name + property select, supplier read-only).
 */
export function MarcheInlineCreator({
  supplierId,
  properties,
  createAction,
  onCreated,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setName('');
    setPropertyId('');
    setError(null);
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Sélectionne un fournisseur avant de créer un marché');
      return;
    }
    if (!propertyId) {
      setError('Sélectionne un bien');
      return;
    }
    if (!name.trim()) {
      setError('Nom requis');
      return;
    }
    setSubmitting(true);
    setError(null);
    const fd = new FormData();
    fd.set('supplierId', supplierId);
    fd.set('propertyId', propertyId);
    fd.set('name', name.trim());
    const res = await createAction(fd);
    if ('error' in res) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    onCreated({ id: res.id, label: res.label });
    reset();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || !supplierId}
        title={!supplierId ? 'Choisis un fournisseur d\'abord' : 'Créer un marché à la volée'}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline"
      >
        <Plus className="h-3 w-3" strokeWidth={2} />
        Créer un marché à la volée
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) reset();
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-zinc-900">Créer un marché</h3>
              <button
                type="button"
                onClick={reset}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Nom *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input mt-1"
                placeholder="Rénovation salle de bain RDC"
                autoFocus
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Bien *</label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                required
                className="input mt-1"
              >
                <option value="">— Choisir un bien —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {properties.length === 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Aucun bien rattaché à cette société. Crée un bien d&apos;abord.
                </p>
              )}
            </div>

            <p className="text-[11px] text-zinc-500">
              Le marché sera créé avec statut <strong>Devis reçu</strong>. Tu pourras le
              compléter ensuite (montants, dates, lots affectés) depuis sa fiche.
            </p>

            {error && (
              <p className="rounded bg-red-50 p-2 text-[12px] text-red-800">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                disabled={submitting}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || properties.length === 0}
                className="btn-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Création…
                  </>
                ) : (
                  'Créer'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';

export interface ComboboxOption {
  id: string;
  label: string;
  hint?: string | null;
}

type CreateResult = { id: string; label: string } | { error: string };

interface Props {
  /** Nom du champ caché soumis avec le form parent. */
  name: string;
  /** Options initiales de la liste déroulante. */
  options: ComboboxOption[];
  /** Valeur initiale (id). */
  defaultValue?: string;
  /** Placeholder du champ. */
  placeholder?: string;
  /** Texte du bouton "Créer un nouveau …". */
  createLabel?: string;
  /** Server action de création inline (FormData → { id, label } | { error }). */
  createAction?: (formData: FormData) => Promise<CreateResult>;
  /** Champs à demander dans le mini-form de création. Default = name+contact. */
  createFields?: Array<'companyName' | 'firstName' | 'lastName' | 'email' | 'phone'>;
  /** Mode requis (l'input caché doit avoir une valeur). */
  required?: boolean;
}

/**
 * Combobox avec recherche locale + création inline d'une entité (locataire,
 * fournisseur, client) sans quitter le formulaire parent. Émet un input caché
 * `<input name={name} value={selectedId}>` pour soumission native.
 */
export function EntityCombobox({
  name,
  options: initialOptions,
  defaultValue,
  placeholder = 'Sélectionner…',
  createLabel = '+ Créer un nouveau',
  createAction,
  createFields = ['companyName', 'firstName', 'lastName', 'email', 'phone'],
  required = false,
}: Props) {
  const [options, setOptions] = useState(initialOptions);
  const [selectedId, setSelectedId] = useState(defaultValue ?? '');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ?? '').toLowerCase().includes(q)
    );
  }, [options, search]);

  const selected = options.find((o) => o.id === selectedId);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!createAction) return;
    setCreating(true);
    setCreateError(null);
    const fd = new FormData(e.currentTarget);
    const res = await createAction(fd);
    setCreating(false);
    if ('error' in res) {
      setCreateError(res.error);
      return;
    }
    const newOpt: ComboboxOption = { id: res.id, label: res.label };
    setOptions((prev) => [newOpt, ...prev]);
    setSelectedId(res.id);
    setShowCreate(false);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selectedId} required={required} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input mt-1 flex w-full items-center justify-between text-left"
      >
        <span className={selected ? 'text-zinc-900' : 'text-zinc-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-200 bg-[#fbf8f0] shadow-lg">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-zinc-400"
            />
            {selectedId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId('');
                }}
                title="Effacer la sélection"
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <ul className="max-h-60 overflow-y-auto text-[13px]">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] italic text-zinc-400">Aucun résultat.</li>
            )}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(o.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-emerald-50 ${
                    o.id === selectedId ? 'bg-emerald-50/60 text-emerald-900' : 'text-zinc-700'
                  }`}
                >
                  <span>{o.label}</span>
                  {o.hint && (
                    <span className="ml-2 text-[11px] text-zinc-400">{o.hint}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {createAction && (
            <div className="border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {createLabel}
              </button>
            </div>
          )}
        </div>
      )}

      {showCreate && createAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={() => !creating && setShowCreate(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-md space-y-3 p-6"
          >
            <h3 className="text-[13px] font-medium uppercase tracking-[0.12em] text-zinc-700">
              {createLabel.replace(/^\+\s*/, '')}
            </h3>

            {createFields.includes('companyName') && (
              <div>
                <label className="block text-[11px] font-medium text-zinc-600">
                  Raison sociale
                </label>
                <input
                  name="companyName"
                  className="input mt-1"
                  placeholder="(optionnel si prénom/nom renseignés)"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {createFields.includes('firstName') && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600">Prénom</label>
                  <input name="firstName" className="input mt-1" />
                </div>
              )}
              {createFields.includes('lastName') && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600">Nom</label>
                  <input name="lastName" className="input mt-1" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {createFields.includes('email') && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600">Email</label>
                  <input type="email" name="email" className="input mt-1" />
                </div>
              )}
              {createFields.includes('phone') && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600">Téléphone</label>
                  <input name="phone" className="input mt-1" />
                </div>
              )}
            </div>

            {createError && (
              <p className="rounded bg-red-50 p-2 text-[12px] text-red-800">{createError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => !creating && setShowCreate(false)}
                disabled={creating}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Création…
                  </>
                ) : (
                  'Créer et sélectionner'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'devis_recu', label: 'Devis reçu' },
  { value: 'signe', label: 'Signé' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livre', label: 'Livré' },
  { value: 'conteste', label: 'Contesté' },
  { value: 'annule', label: 'Annulé' },
];

interface LotOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  label: string;
}

export interface MarcheFormValues {
  id?: string;
  supplierId?: string;
  name?: string;
  description?: string | null;
  amountHt?: string | null;
  amountTtc?: string | null;
  dateDevis?: string | null;
  dateSignature?: string | null;
  dateDebutPrevu?: string | null;
  dateFinPrevu?: string | null;
  status?: string;
  notes?: string | null;
  lotIds?: string[];
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  propertyId: string;
  propertyName: string;
  lots: LotOption[];
  suppliers: SupplierOption[];
  defaultValues?: MarcheFormValues;
  cancelHref: string;
  submitLabel?: string;
}

export function MarcheForm({
  action,
  propertyId,
  propertyName,
  lots,
  suppliers,
  defaultValues = {},
  cancelHref,
  submitLabel = 'Enregistrer',
}: Props) {
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(
    new Set(defaultValues.lotIds ?? [])
  );

  const toggleLot = (lotId: string) => {
    const next = new Set(selectedLotIds);
    if (next.has(lotId)) next.delete(lotId);
    else next.add(lotId);
    setSelectedLotIds(next);
  };

  return (
    <form action={action} className="card space-y-5 p-6">
      <input type="hidden" name="propertyId" value={propertyId} />
      {defaultValues.id && <input type="hidden" name="id" value={defaultValues.id} />}
      {Array.from(selectedLotIds).map((lotId) => (
        <input key={lotId} type="hidden" name="lotIds" value={lotId} />
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium">Nom du marché *</label>
          <input
            name="name"
            defaultValue={defaultValues.name ?? ''}
            required
            className="input mt-1"
            placeholder="Ex: Réfection plomberie SDB"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium">Description</label>
          <textarea
            name="description"
            defaultValue={defaultValues.description ?? ''}
            rows={3}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Fournisseur *</label>
          <select
            name="supplierId"
            defaultValue={defaultValues.supplierId ?? ''}
            required
            className="input mt-1"
          >
            <option value="">— Choisir —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Statut *</label>
          <select
            name="status"
            defaultValue={defaultValues.status ?? 'devis_recu'}
            required
            className="input mt-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Montant HT (€)</label>
          <input
            name="amountHt"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues.amountHt ?? ''}
            className="input mt-1 tabular-nums"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Montant TTC (€)</label>
          <input
            name="amountTtc"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues.amountTtc ?? ''}
            className="input mt-1 tabular-nums"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Date du devis</label>
          <input
            name="dateDevis"
            type="date"
            defaultValue={defaultValues.dateDevis ?? ''}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Date de signature</label>
          <input
            name="dateSignature"
            type="date"
            defaultValue={defaultValues.dateSignature ?? ''}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Début prévu</label>
          <input
            name="dateDebutPrevu"
            type="date"
            defaultValue={defaultValues.dateDebutPrevu ?? ''}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Fin prévue</label>
          <input
            name="dateFinPrevu"
            type="date"
            defaultValue={defaultValues.dateFinPrevu ?? ''}
            className="input mt-1"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            defaultValue={defaultValues.notes ?? ''}
            rows={3}
            className="input mt-1"
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Lots concernés sur {propertyName}</h3>
          <span className="text-xs text-slate-500">
            {selectedLotIds.size === 0
              ? 'Aucun (parties communes / structurel)'
              : `${selectedLotIds.size} sélectionné${selectedLotIds.size > 1 ? 's' : ''}`}
          </span>
        </div>
        {lots.length === 0 ? (
          <p className="text-xs text-slate-500">
            Ce bien n'a pas encore de lots. Le marché sera rattaché au bien (parties communes).
          </p>
        ) : (
          <ul className="space-y-1.5">
            {lots.map((lot) => (
              <li key={lot.id}>
                <label className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-white">
                  <input
                    type="checkbox"
                    checked={selectedLotIds.has(lot.id)}
                    onChange={() => toggleLot(lot.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {lot.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Laisse vide pour un marché de parties communes (toiture, façade, ascenseur…). Coche un
          ou plusieurs lots si les travaux sont localisés.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={cancelHref} className="btn-secondary">
          Annuler
        </Link>
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

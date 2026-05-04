import { Plus, Trash2 } from 'lucide-react';
import {
  createMarcheSousLotAction,
  deleteMarcheSousLotAction,
} from '@/app/(dashboard)/marches/actions';

export type MarcheSousLot = {
  id: string;
  name: string;
  amountHt: string | null;
  dateDebutPrevu: string | null;
  dateFinPrevu: string | null;
};

interface Props {
  marcheId: string;
  sousLots: MarcheSousLot[];
}

const CORPS_ETAT_LIST = [
  'Démolition',
  'Placo et enduits',
  'Peinture',
  'Sol',
  'Maçonnerie',
  'Électricité',
  'Plomberie',
  'Couverture',
  'Façade',
  'Cuisine',
  'Porte et Fenêtres',
  'Aménagements',
];

export function MarcheSousLotsSection({ marcheId, sousLots }: Props) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-zinc-900">Sous-lots techniques</h4>

      {sousLots.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucun sous-lot pour ce marché.</p>
      ) : (
        <ul className="space-y-2">
          {sousLots.map((sl) => (
            <li
              key={sl.id}
              className="flex items-center justify-between rounded-md border border-zinc-100 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-800">{sl.name}</p>
                {sl.amountHt && (
                  <p className="text-[12px] text-zinc-500">
                    {Number(sl.amountHt).toLocaleString('fr-FR')} € HT
                  </p>
                )}
              </div>
              <form action={deleteMarcheSousLotAction}>
                <input type="hidden" name="sousLotId" value={sl.id} />
                <button
                  type="submit"
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={createMarcheSousLotAction} className="space-y-3 rounded-md border border-dashed border-zinc-200 bg-[#fbf8f0] p-4">
        <input type="hidden" name="marcheId" value={marcheId} />

        <div>
          <label className="block text-[12px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Corps d'état
          </label>
          <select
            name="name"
            required
            className="input mt-1 text-[13px]"
          >
            <option value="">Sélectionner…</option>
            {CORPS_ETAT_LIST.map((ce) => (
              <option key={ce} value={ce}>
                {ce}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Montant HT
            </label>
            <input
              name="amountHt"
              type="number"
              step="0.01"
              min="0"
              placeholder="—"
              className="input mt-1 tnum text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Fin prévue
            </label>
            <input
              name="dateFinPrevu"
              type="date"
              className="input mt-1 text-[13px]"
            />
          </div>
        </div>

        <button type="submit" className="btn-secondary w-full">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ajouter un sous-lot
        </button>
      </form>
    </div>
  );
}

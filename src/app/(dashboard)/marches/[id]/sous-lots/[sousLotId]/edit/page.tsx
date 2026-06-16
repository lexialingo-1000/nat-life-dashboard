import { db } from '@/db/client';
import { marcheSousLots, marcheTypes } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { updateSousLotAction } from '@/app/(dashboard)/marches/actions';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: 'devis_recu', label: 'Devis reçu' },
  { value: 'signe', label: 'Signé' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livre', label: 'Livré' },
  { value: 'conteste', label: 'Contesté' },
  { value: 'annule', label: 'Annulé' },
];

// V12bis PR9 §6 — Modifier un sous-lot (retours Natacha dashboard-13).
export default async function EditSousLotPage({
  params,
}: {
  params: { id: string; sousLotId: string };
}) {
  const sousLotRow = await db
    .select()
    .from(marcheSousLots)
    .where(eq(marcheSousLots.id, params.sousLotId))
    .limit(1);
  if (sousLotRow.length === 0) notFound();
  const sl = sousLotRow[0];

  const typeOptions = await db
    .select({ id: marcheTypes.id, label: marcheTypes.label })
    .from(marcheTypes)
    .where(eq(marcheTypes.isActive, true))
    .orderBy(asc(marcheTypes.sortOrder), asc(marcheTypes.label));

  const returnTo = `/marches/${params.id}`;

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref={returnTo} label="Retour" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Marché · Sous-lot
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier</span>{' '}
          <span className="text-zinc-900">{sl.name}</span>
        </h1>
      </header>

      <form action={updateSousLotAction} className="card space-y-5 p-6" autoComplete="off">
        <input type="hidden" name="id" value={sl.id} />
        <input type="hidden" name="marcheId" value={sl.marcheId} />

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Nom *</label>
          <input
            name="name"
            required
            defaultValue={sl.name}
            className="input mt-1"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Type de marché</label>
            <select name="marcheTypeId" defaultValue={sl.marcheTypeId ?? ''} className="input mt-1">
              <option value="">— Aucun —</option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Statut</label>
            <select name="status" defaultValue={sl.status} className="input mt-1">
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Montant HT (€)</label>
            <input
              type="number"
              step="0.01"
              name="amountHt"
              defaultValue={sl.amountHt ?? ''}
              className="input tnum mt-1"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Montant TTC (€)</label>
            <input
              type="number"
              step="0.01"
              name="amountTtc"
              defaultValue={sl.amountTtc ?? ''}
              className="input tnum mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Date début prévue</label>
            <input
              type="date"
              name="dateDebutPrevu"
              defaultValue={sl.dateDebutPrevu ?? ''}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Date fin prévue</label>
            <input
              type="date"
              name="dateFinPrevu"
              defaultValue={sl.dateFinPrevu ?? ''}
              className="input mt-1"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Description</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={sl.description ?? ''}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={sl.notes ?? ''}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={returnTo} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

import { db } from '@/db/client';
import { lots, properties, companies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { updateLotAction } from '../../../actions';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
  { value: 'garage', label: 'Garage' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'terrain', label: 'Terrain' },
];

const STATUS_OPTIONS = [
  { value: 'vacant', label: 'Vacant' },
  { value: 'loue_annuel', label: 'Loué annuel' },
  { value: 'loue_saisonnier', label: 'Loué saisonnier' },
  { value: 'travaux', label: 'Travaux' },
];

export default async function EditLotPage({ params }: { params: { id: string } }) {
  const rows = await db
    .select({
      id: lots.id,
      name: lots.name,
      type: lots.type,
      status: lots.status,
      surfaceCarrez: lots.surfaceCarrez,
      surfaceBoutin: lots.surfaceBoutin,
      notes: lots.notes,
      propertyId: properties.id,
      propertyName: properties.name,
      companyName: companies.name,
    })
    .from(lots)
    .innerJoin(properties, eq(lots.propertyId, properties.id))
    .innerJoin(companies, eq(properties.companyId, companies.id))
    .where(eq(lots.id, params.id))
    .limit(1);

  if (rows.length === 0) notFound();
  const lot = rows[0];

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/biens/lots/${lot.id}`}
        className="inline-flex items-center text-sm text-zinc-600 hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {lot.name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modifier le lot</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {lot.companyName} · {lot.propertyName}
        </p>
      </div>

      <form action={updateLotAction} className="card space-y-4 p-6">
        <input type="hidden" name="id" value={lot.id} />

        <div>
          <label className="block text-sm font-medium">Nom *</label>
          <input
            name="name"
            defaultValue={lot.name}
            required
            className="input mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Type *</label>
            <select name="type" defaultValue={lot.type} required className="input mt-1">
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Statut *</label>
            <select name="status" defaultValue={lot.status} required className="input mt-1">
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
            <label className="block text-sm font-medium">Surface Carrez (m²)</label>
            <input
              name="surfaceCarrez"
              type="number"
              step="0.01"
              min="0"
              defaultValue={lot.surfaceCarrez ?? ''}
              className="input mt-1 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Surface Boutin (m²)</label>
            <input
              name="surfaceBoutin"
              type="number"
              step="0.01"
              min="0"
              defaultValue={lot.surfaceBoutin ?? ''}
              className="input mt-1 tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            defaultValue={lot.notes ?? ''}
            rows={4}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/biens/lots/${lot.id}`} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

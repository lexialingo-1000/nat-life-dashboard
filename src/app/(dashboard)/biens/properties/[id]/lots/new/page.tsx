import { db } from '@/db/client';
import { properties, companies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { createLotAction } from '@/app/(dashboard)/biens/actions';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS: { value: 'appartement' | 'maison' | 'garage' | 'immeuble' | 'terrain'; label: string }[] = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
  { value: 'garage', label: 'Garage' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'terrain', label: 'Terrain' },
];

const STATUS_OPTIONS: { value: 'vacant' | 'loue_annuel' | 'loue_saisonnier' | 'travaux'; label: string }[] = [
  { value: 'vacant', label: 'Vacant' },
  { value: 'loue_annuel', label: 'Loué annuel' },
  { value: 'loue_saisonnier', label: 'Loué saisonnier' },
  { value: 'travaux', label: 'Travaux' },
];

export default async function NewLotPage({ params }: { params: { id: string } }) {
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      type: properties.type,
      companyName: companies.name,
    })
    .from(properties)
    .innerJoin(companies, eq(properties.companyId, companies.id))
    .where(eq(properties.id, params.id))
    .limit(1);
  if (rows.length === 0) notFound();
  const property = rows[0];

  return (
    <div className="max-w-2xl space-y-8">
      <BackLink fallbackHref={`/biens/properties/${property.id}`} label={property.name} />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Patrimoine · {property.companyName}
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Ajouter un lot</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Crée un lot rattaché à <span className="font-medium text-zinc-700">{property.name}</span>.
          Les niveaux et pièces s'ajoutent ensuite via l'arborescence du bien ou la fiche du lot.
        </p>
      </header>

      <form action={createLotAction} className="card space-y-4 p-6">
        <input type="hidden" name="propertyId" value={property.id} />

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Nom du lot *</label>
          <input
            name="name"
            required
            className="input mt-1"
            placeholder="RDC Appartement, Garage Bocage…"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Identifie ce lot au sein de l'immeuble.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Type *</label>
            <select name="type" required className="input mt-1" defaultValue="appartement">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Statut *</label>
            <select name="status" required className="input mt-1" defaultValue="vacant">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Surface Carrez (m²)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            name="surfaceCarrez"
            className="input mt-1 tnum"
            placeholder="—"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Optionnel. Surface habitable au sens loi Carrez.
          </p>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            className="input mt-1"
            placeholder="—"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href={`/biens/properties/${property.id}`} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Créer le lot
          </button>
        </div>
      </form>
    </div>
  );
}

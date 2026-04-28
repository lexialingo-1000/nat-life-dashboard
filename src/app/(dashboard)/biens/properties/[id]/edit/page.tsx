import { db } from '@/db/client';
import { properties, companies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { updatePropertyAction } from '../../actions';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
  { value: 'garage', label: 'Garage' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'terrain', label: 'Terrain' },
];

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      type: properties.type,
      address: properties.address,
      city: properties.city,
      postalCode: properties.postalCode,
      purchaseDate: properties.purchaseDate,
      purchasePrice: properties.purchasePrice,
      notaire: properties.notaire,
      cadastre: properties.cadastre,
      notes: properties.notes,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(properties)
    .innerJoin(companies, eq(properties.companyId, companies.id))
    .where(eq(properties.id, params.id))
    .limit(1);

  if (rows.length === 0) notFound();
  const p = rows[0];
  const notaire = (p.notaire as any) ?? {};

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        href={`/biens/properties/${p.id}`}
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {p.name}
      </Link>

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Édition
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier</span>{' '}
          <span className="text-zinc-900">{p.name}</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">{p.companyName}</p>
      </header>

      <form action={updatePropertyAction} className="space-y-6">
        <input type="hidden" name="id" value={p.id} />

        <Section title="Identité">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom" required>
              <input name="name" defaultValue={p.name} required className="input" />
            </Field>
            <Field label="Type" required>
              <select name="type" defaultValue={p.type} required className="input">
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Adresse">
          <Field label="Rue / voie">
            <input name="address" defaultValue={p.address ?? ''} className="input" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Code postal">
              <input
                name="postalCode"
                defaultValue={p.postalCode ?? ''}
                className="input font-mono"
                placeholder="13090"
              />
            </Field>
            <Field label="Ville" className="col-span-2">
              <input name="city" defaultValue={p.city ?? ''} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Acquisition">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date d'achat">
              <input
                type="date"
                name="purchaseDate"
                defaultValue={p.purchaseDate ?? ''}
                className="input"
              />
            </Field>
            <Field label="Prix d'achat (€)">
              <input
                type="number"
                step="0.01"
                name="purchasePrice"
                defaultValue={p.purchasePrice ?? ''}
                className="input tnum"
              />
            </Field>
          </div>
          <Field label="Référence cadastrale">
            <input
              name="cadastre"
              defaultValue={p.cadastre ?? ''}
              className="input font-mono"
              placeholder="000 AB 0123"
            />
          </Field>
        </Section>

        <Section title="Notaire">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom">
              <input name="notaireName" defaultValue={notaire.name ?? ''} className="input" />
            </Field>
            <Field label="Étude">
              <input name="notaireEtude" defaultValue={notaire.etude ?? ''} className="input" />
            </Field>
            <Field label="Téléphone">
              <input name="notairePhone" defaultValue={notaire.phone ?? ''} className="input" />
            </Field>
            <Field label="Email">
              <input
                type="email"
                name="notaireEmail"
                defaultValue={notaire.email ?? ''}
                className="input"
              />
            </Field>
          </div>
        </Section>

        <Section title="Notes">
          <textarea name="notes" defaultValue={p.notes ?? ''} rows={4} className="input" />
        </Section>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/biens/properties/${p.id}`} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[12px] font-medium text-zinc-700">
        {label} {required && <span className="text-emerald-700">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

import { db } from '@/db/client';
import { companies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { updateSocieteAction } from '../../actions';
import { SocieteFormFields } from '@/components/societe-form-fields';

export const dynamic = 'force-dynamic';

export default async function EditSocietePage({ params }: { params: { id: string } }) {
  const rows = await db.select().from(companies).where(eq(companies.id, params.id)).limit(1);
  if (rows.length === 0) notFound();
  const company = rows[0];

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref={`/societes/${company.id}`} label={company.name} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modifier la société</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Édite les informations de <span className="font-medium">{company.name}</span>.
        </p>
      </div>

      <form action={updateSocieteAction} className="card space-y-4 p-6">
        <input type="hidden" name="id" value={company.id} />

        <SocieteFormFields
          defaultValues={{
            name: company.name,
            siren: company.siren,
            type: company.type,
            formeJuridique: company.formeJuridique,
            address: company.address,
            activitePrincipale: company.activitePrincipale,
            nafCode: company.nafCode,
            isActive: (company as { isActive?: boolean }).isActive ?? true,
          }}
          enableSirenLookup
          showActiveToggle
        />

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/societes/${company.id}`} className="btn-secondary">
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

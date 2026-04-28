import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheLotAffectations,
  lots,
  properties,
  companies,
  suppliers,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { deleteMarcheAction } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

export default async function MarcheDetailPage({ params }: { params: { id: string } }) {
  const rows = await db
    .select({
      id: marchesTravaux.id,
      name: marchesTravaux.name,
      description: marchesTravaux.description,
      amountHt: marchesTravaux.amountHt,
      amountTtc: marchesTravaux.amountTtc,
      dateDevis: marchesTravaux.dateDevis,
      dateSignature: marchesTravaux.dateSignature,
      dateDebutPrevu: marchesTravaux.dateDebutPrevu,
      dateFinPrevu: marchesTravaux.dateFinPrevu,
      status: marchesTravaux.status,
      notes: marchesTravaux.notes,
      propertyId: properties.id,
      propertyName: properties.name,
      companyId: companies.id,
      companyName: companies.name,
      supplierId: suppliers.id,
      supplierName: suppliers.companyName,
      supplierFirstName: suppliers.firstName,
      supplierLastName: suppliers.lastName,
    })
    .from(marchesTravaux)
    .innerJoin(properties, eq(marchesTravaux.propertyId, properties.id))
    .innerJoin(companies, eq(properties.companyId, companies.id))
    .innerJoin(suppliers, eq(marchesTravaux.supplierId, suppliers.id))
    .where(eq(marchesTravaux.id, params.id))
    .limit(1);

  if (rows.length === 0) notFound();
  const marche = rows[0];

  const affectedLots = await db
    .select({ id: lots.id, name: lots.name })
    .from(marcheLotAffectations)
    .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
    .where(eq(marcheLotAffectations.marcheId, marche.id))
    .orderBy(asc(lots.name));

  const supplierLabel =
    marche.supplierName ??
    `${marche.supplierFirstName ?? ''} ${marche.supplierLastName ?? ''}`.trim() ??
    '—';

  return (
    <div className="space-y-6">
      <Link
        href="/marches"
        className="inline-flex items-center text-sm text-slate-600 hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Marchés de travaux
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
            <Link href={`/societes/${marche.companyId}`} className="hover:text-amber-800">
              {marche.companyName}
            </Link>{' '}
            ·{' '}
            <Link
              href={`/biens/properties/${marche.propertyId}`}
              className="hover:text-amber-800"
            >
              {marche.propertyName}
            </Link>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{marche.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fournisseur :{' '}
            <Link
              href={`/fournisseurs/${marche.supplierId}`}
              className="font-medium hover:underline"
            >
              {supplierLabel}
            </Link>{' '}
            · Statut :{' '}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
              {STATUS_LABELS[marche.status] ?? marche.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/marches/${marche.id}/edit`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Modifier
          </Link>
          <DeleteButton
            action={deleteMarcheAction}
            id={marche.id}
            label="Supprimer"
            confirmationPhrase={marche.name}
            description={`Cette action est irréversible. Le marché "${marche.name}" sera supprimé. Les sous-lots techniques et documents associés seront aussi supprimés.`}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            Montants
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="HT">
              {marche.amountHt
                ? `${Number(marche.amountHt).toLocaleString('fr-FR')} €`
                : '—'}
            </Row>
            <Row label="TTC">
              {marche.amountTtc
                ? `${Number(marche.amountTtc).toLocaleString('fr-FR')} €`
                : '—'}
            </Row>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            Dates
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Devis">{marche.dateDevis ?? '—'}</Row>
            <Row label="Signature">{marche.dateSignature ?? '—'}</Row>
            <Row label="Début prévu">{marche.dateDebutPrevu ?? '—'}</Row>
            <Row label="Fin prévue">{marche.dateFinPrevu ?? '—'}</Row>
          </dl>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
          Lots concernés
        </h2>
        {affectedLots.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun lot affecté — marché de parties communes / structurel.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {affectedLots.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/biens/lots/${l.id}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-50"
                >
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(marche.description || marche.notes) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {marche.description && (
            <div className="card p-5">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Description
              </h2>
              <p className="whitespace-pre-wrap text-sm">{marche.description}</p>
            </div>
          )}
          {marche.notes && (
            <div className="card p-5">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Notes
              </h2>
              <p className="whitespace-pre-wrap text-sm">{marche.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

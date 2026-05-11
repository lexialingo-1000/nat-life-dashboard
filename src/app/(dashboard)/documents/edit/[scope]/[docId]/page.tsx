import { db } from '@/db/client';
import {
  companyDocuments,
  supplierDocuments,
  customerDocuments,
  propertyDocuments,
  lotDocuments,
  marcheDocuments,
  locationDocuments,
  documentTypes,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { DeleteButton } from '@/components/delete-button';
import {
  updateDocumentAction,
  deleteDocumentByScopeAction,
  PARENT_FIELD_BY_SCOPE,
  type DocumentScope,
} from '../../../actions';

export const dynamic = 'force-dynamic';

const TABLES = {
  company: companyDocuments,
  supplier: supplierDocuments,
  customer: customerDocuments,
  property: propertyDocuments,
  lot: lotDocuments,
  marche: marcheDocuments,
  location: locationDocuments,
} as const;

const SCOPE_LABELS: Record<DocumentScope, string> = {
  company: 'Société',
  supplier: 'Fournisseur',
  customer: 'Client',
  property: 'Bien',
  lot: 'Lot',
  marche: 'Marché',
  location: 'Location',
};

const BACK_PATHS: Record<DocumentScope, (parentId: string) => string> = {
  company: (id) => `/societes/${id}`,
  supplier: (id) => `/fournisseurs/${id}`,
  customer: (id) => `/clients/${id}`,
  property: (id) => `/biens/properties/${id}`,
  lot: (id) => `/biens/lots/${id}`,
  marche: (id) => `/marches/${id}`,
  location: (id) => `/locations/${id}`,
};

function isValidScope(s: string): s is DocumentScope {
  return s in TABLES;
}

export default async function EditDocumentPage({
  params,
}: {
  params: { scope: string; docId: string };
}) {
  if (!isValidScope(params.scope)) notFound();
  const scope: DocumentScope = params.scope;
  const table = TABLES[scope];
  const parentField = PARENT_FIELD_BY_SCOPE[scope];

  // SELECT * équivalent : on prend tous les champs utiles côté form.
  const rows = await db
    .select({
      id: table.id,
      name: table.name,
      typeId: table.typeId,
      typeLabel: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
      storageKey: table.storageKey,
      documentDate: table.documentDate,
      expiresAt: table.expiresAt,
      notes: table.notes,
      uploadedAt: table.uploadedAt,
      // @ts-expect-error — Drizzle ne sait pas que les 7 tables exposent toutes
      // un champ parent (companyId/supplierId/.../locationId). On lit via indexer.
      parentId: table[parentField],
    })
    .from(table)
    .innerJoin(documentTypes, eq(table.typeId, documentTypes.id))
    .where(eq(table.id, params.docId))
    .limit(1);

  if (rows.length === 0) notFound();
  const doc = rows[0];

  const backHref = BACK_PATHS[scope](doc.parentId);
  const scopeLabel = SCOPE_LABELS[scope];

  return (
    <div className="space-y-8 max-w-2xl">
      <BackLink fallbackHref={backHref} label={`${scopeLabel} · Documents`} />

      <header>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Documents · {scopeLabel}
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier</span> · {doc.name}
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Type : <span className="font-medium text-zinc-700">{doc.typeLabel}</span> (verrouillé après
          upload). Le fichier source n'est pas modifiable — réuploade un nouveau document pour
          remplacer.
        </p>
      </header>

      <form action={updateDocumentAction} className="card space-y-5 p-6">
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="id" value={doc.id} />
        <input type="hidden" name="parentId" value={doc.parentId} />

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Nom *</label>
          <input
            name="name"
            required
            defaultValue={doc.name}
            className="input mt-1"
            placeholder="Ex: KBis 2026"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Date du document</label>
            <input
              name="documentDate"
              type="date"
              defaultValue={doc.documentDate ?? ''}
              className="input mt-1"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Format DD/MM/YYYY supporté via picker navigateur.
            </p>
          </div>
          {doc.hasExpiration && (
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Expire le</label>
              <input
                name="expiresAt"
                type="date"
                defaultValue={doc.expiresAt ?? ''}
                className="input mt-1"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={doc.notes ?? ''}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <DeleteButton
            action={deleteDocumentByScopeAction}
            id={doc.id}
            label="Supprimer ce document"
            confirmationPhrase={doc.name}
            description={`Supprimer définitivement le document "${doc.name}" (${doc.typeLabel}) ? Le fichier MinIO et la ligne DB seront supprimés. Action irréversible.`}
            extraFields={{ scope, parentId: doc.parentId }}
          />
          <div className="flex gap-3">
            <Link href={backHref} className="btn-secondary">
              Annuler
            </Link>
            <button type="submit" className="btn-primary">
              <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

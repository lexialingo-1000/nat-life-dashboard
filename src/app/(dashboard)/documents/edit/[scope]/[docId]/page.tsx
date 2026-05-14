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
  type DocumentScope,
} from '../../../actions';

export const dynamic = 'force-dynamic';

async function fetchDoc(scope: DocumentScope, docId: string) {
  const baseSelect = {
    typeLabel: documentTypes.label,
    hasExpiration: documentTypes.hasExpiration,
  };
  switch (scope) {
    case 'company': {
      const r = await db
        .select({
          id: companyDocuments.id,
          name: companyDocuments.name,
          parentId: companyDocuments.companyId,
          storageKey: companyDocuments.storageKey,
          documentDate: companyDocuments.documentDate,
          expiresAt: companyDocuments.expiresAt,
          notes: companyDocuments.notes,
          category: companyDocuments.category,
          ...baseSelect,
        })
        .from(companyDocuments)
        .innerJoin(documentTypes, eq(companyDocuments.typeId, documentTypes.id))
        .where(eq(companyDocuments.id, docId))
        .limit(1);
      return r[0];
    }
    case 'supplier': {
      const r = await db
        .select({
          id: supplierDocuments.id,
          name: supplierDocuments.name,
          parentId: supplierDocuments.supplierId,
          storageKey: supplierDocuments.storageKey,
          documentDate: supplierDocuments.documentDate,
          expiresAt: supplierDocuments.expiresAt,
          notes: supplierDocuments.notes,
          category: supplierDocuments.category,
          ...baseSelect,
        })
        .from(supplierDocuments)
        .innerJoin(documentTypes, eq(supplierDocuments.typeId, documentTypes.id))
        .where(eq(supplierDocuments.id, docId))
        .limit(1);
      return r[0];
    }
    case 'customer': {
      const r = await db
        .select({
          id: customerDocuments.id,
          name: customerDocuments.name,
          parentId: customerDocuments.customerId,
          storageKey: customerDocuments.storageKey,
          documentDate: customerDocuments.documentDate,
          expiresAt: customerDocuments.expiresAt,
          notes: customerDocuments.notes,
          category: customerDocuments.category,
          ...baseSelect,
        })
        .from(customerDocuments)
        .innerJoin(documentTypes, eq(customerDocuments.typeId, documentTypes.id))
        .where(eq(customerDocuments.id, docId))
        .limit(1);
      return r[0];
    }
    case 'property': {
      const r = await db
        .select({
          id: propertyDocuments.id,
          name: propertyDocuments.name,
          parentId: propertyDocuments.propertyId,
          storageKey: propertyDocuments.storageKey,
          documentDate: propertyDocuments.documentDate,
          expiresAt: propertyDocuments.expiresAt,
          notes: propertyDocuments.notes,
          category: propertyDocuments.category,
          ...baseSelect,
        })
        .from(propertyDocuments)
        .innerJoin(documentTypes, eq(propertyDocuments.typeId, documentTypes.id))
        .where(eq(propertyDocuments.id, docId))
        .limit(1);
      return r[0];
    }
    case 'lot': {
      const r = await db
        .select({
          id: lotDocuments.id,
          name: lotDocuments.name,
          parentId: lotDocuments.lotId,
          storageKey: lotDocuments.storageKey,
          documentDate: lotDocuments.documentDate,
          expiresAt: lotDocuments.expiresAt,
          notes: lotDocuments.notes,
          category: lotDocuments.category,
          ...baseSelect,
        })
        .from(lotDocuments)
        .innerJoin(documentTypes, eq(lotDocuments.typeId, documentTypes.id))
        .where(eq(lotDocuments.id, docId))
        .limit(1);
      return r[0];
    }
    case 'marche': {
      const r = await db
        .select({
          id: marcheDocuments.id,
          name: marcheDocuments.name,
          parentId: marcheDocuments.marcheId,
          storageKey: marcheDocuments.storageKey,
          documentDate: marcheDocuments.documentDate,
          expiresAt: marcheDocuments.expiresAt,
          notes: marcheDocuments.notes,
          category: marcheDocuments.category,
          ...baseSelect,
        })
        .from(marcheDocuments)
        .innerJoin(documentTypes, eq(marcheDocuments.typeId, documentTypes.id))
        .where(eq(marcheDocuments.id, docId))
        .limit(1);
      return r[0];
    }
    case 'location': {
      const r = await db
        .select({
          id: locationDocuments.id,
          name: locationDocuments.name,
          parentId: locationDocuments.locationId,
          storageKey: locationDocuments.storageKey,
          documentDate: locationDocuments.documentDate,
          expiresAt: locationDocuments.expiresAt,
          notes: locationDocuments.notes,
          category: locationDocuments.category,
          ...baseSelect,
        })
        .from(locationDocuments)
        .innerJoin(documentTypes, eq(locationDocuments.typeId, documentTypes.id))
        .where(eq(locationDocuments.id, docId))
        .limit(1);
      return r[0];
    }
  }
}

const VALID_SCOPES = new Set<DocumentScope>([
  'company',
  'supplier',
  'customer',
  'property',
  'lot',
  'marche',
  'location',
]);

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
  return VALID_SCOPES.has(s as DocumentScope);
}

export default async function EditDocumentPage({
  params,
}: {
  params: { scope: string; docId: string };
}) {
  if (!isValidScope(params.scope)) notFound();
  const scope: DocumentScope = params.scope;

  const doc = await fetchDoc(scope, params.docId);
  if (!doc) notFound();

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
          <label className="block text-[12px] font-medium text-zinc-700">Catégorie</label>
          <select
            name="category"
            defaultValue={doc.category ?? ''}
            className="input mt-1"
          >
            <option value="">— Sans catégorie —</option>
            <option value="notaire">Notaire</option>
            <option value="banque">Banque</option>
            <option value="juridique">Juridique</option>
            <option value="comptabilite">Comptabilité</option>
            <option value="courant">Courant</option>
            <option value="location">Location</option>
          </select>
          <p className="mt-1 text-[11px] text-zinc-500">
            Indépendante du type. Permet de filtrer les listes de documents.
          </p>
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

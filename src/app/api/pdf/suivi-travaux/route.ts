import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import sharp from 'sharp';
import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheSousLots,
  marcheTaches,
  marcheTypes,
  suppliers,
  rooms,
  levels,
  marcheLotAffectations,
  lots,
  properties,
} from '@/db/schema';
import { eq, inArray, asc, and, ne } from 'drizzle-orm';
import { getPresignedDownloadUrl } from '@/lib/storage/minio';
import { SuiviTravauxPDF, marcheHeading, type PdfMarche } from '@/lib/pdf/suivi-travaux-pdf';
import { sortByTacheStatus } from '@/lib/utils';

// dashboard-22 — API route PDF suivi de travaux
// GET /api/pdf/suivi-travaux?marcheId=<id>
// GET /api/pdf/suivi-travaux?lotId=<id>
// GET /api/pdf/suivi-travaux?supplierId=<id>
// GET /api/pdf/suivi-travaux?propertyId=<id>  (retours 24/11 pt 3 : marchés ACTIFS du bien)

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f-]{36}$/i;

// Retours 24/11 pt 4a — adresse du bien sous le titre.
type AddressParts = { address: string | null; postalCode: string | null; city: string | null };
function formatAddress(p: AddressParts | null | undefined): string | undefined {
  if (!p) return undefined;
  const cityLine = [p.postalCode, p.city].filter(Boolean).join(' ');
  return [p.address, cityLine].filter(Boolean).join(', ') || undefined;
}

// dashboard-24 — fiabilise les photos du PDF. On télécharge les octets côté
// serveur (1 retry) PUIS on ré-encode systématiquement via sharp avant de les
// embarquer en data URI. Raison : les JPEG iPhone récents (Apple MPF/HDR, EXIF
// orientation, 24 MP) ne sont PAS décodés par @react-pdf ("Unknown version") →
// l'image n'est pas dessinée mais réserve quand même sa largeur → slot vide qui
// décale les photos suivantes. sharp applique l'orientation EXIF, supprime les
// segments MPF/EXIF, réduit la taille et sort un JPEG propre que react-pdf rend
// toujours (et allège fortement le PDF : ~4 Mo → ~80 Ko par photo). Une photo
// illisible (sharp échoue) est simplement omise → pas de slot vide.
async function fetchPhotoDataUri(key: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = await getPresignedDownloadUrl(key, 3600);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const input = Buffer.from(await res.arrayBuffer());
      const jpeg = await sharp(input)
        .rotate() // applique l'orientation EXIF
        .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
    }
  }
  return null; // échec après retry / image illisible → photo omise (pas de slot vide)
}

async function getPhotoUrls(keys: string[]): Promise<string[]> {
  const uris: string[] = [];
  for (const key of keys.slice(0, 4)) {
    const uri = await fetchPhotoDataUri(key);
    if (uri) uris.push(uri);
  }
  return uris;
}

async function buildMarcheNodes(marcheIds: string[]): Promise<PdfMarche[]> {
  if (marcheIds.length === 0) return [];

  const marcheRows = await db
    .select({
      id: marchesTravaux.id,
      name: marchesTravaux.name,
      status: marchesTravaux.status,
      amountHt: marchesTravaux.amountHt,
      marcheTypeLabel: marcheTypes.label,
      supplierCompanyName: suppliers.companyName,
      supplierFirstName: suppliers.firstName,
      supplierLastName: suppliers.lastName,
    })
    .from(marchesTravaux)
    .leftJoin(suppliers, eq(suppliers.id, marchesTravaux.supplierId))
    .leftJoin(marcheTypes, eq(marcheTypes.id, marchesTravaux.marcheTypeId))
    .where(inArray(marchesTravaux.id, marcheIds))
    .orderBy(asc(marchesTravaux.name));

  const sousLotRows = await db
    .select({
      id: marcheSousLots.id,
      marcheId: marcheSousLots.marcheId,
      name: marcheSousLots.name,
      status: marcheSousLots.status,
      sortOrder: marcheSousLots.sortOrder,
      marcheTypeLabel: marcheTypes.label,
    })
    .from(marcheSousLots)
    .leftJoin(marcheTypes, eq(marcheSousLots.marcheTypeId, marcheTypes.id))
    .where(inArray(marcheSousLots.marcheId, marcheIds))
    .orderBy(asc(marcheSousLots.sortOrder), asc(marcheSousLots.name));

  const sousLotIds = sousLotRows.map((s) => s.id);
  const tacheRows =
    sousLotIds.length > 0
      ? await db
          .select({
            id: marcheTaches.id,
            marcheSousLotId: marcheTaches.marcheSousLotId,
            title: marcheTaches.title,
            status: marcheTaches.status,
            dueDate: marcheTaches.dueDate,
            locationDescription: marcheTaches.locationDescription,
            photos: marcheTaches.photos,
            roomName: rooms.name,
            levelName: levels.name,
          })
          .from(marcheTaches)
          .leftJoin(rooms, eq(marcheTaches.roomId, rooms.id))
          .leftJoin(levels, eq(rooms.levelId, levels.id))
          // dashboard-23 R6a — ne pas imprimer les tâches VALIDÉ.
          .where(
            and(
              inArray(marcheTaches.marcheSousLotId, sousLotIds),
              ne(marcheTaches.status, 'valide'),
            ),
          )
          .orderBy(asc(marcheTaches.dueDate), asc(marcheTaches.createdAt))
      : [];

  // Group tâches by sousLotId
  const tachesBySousLot = new Map<string, typeof tacheRows>();
  for (const t of tacheRows) {
    if (!t.marcheSousLotId) continue;
    if (!tachesBySousLot.has(t.marcheSousLotId)) tachesBySousLot.set(t.marcheSousLotId, []);
    tachesBySousLot.get(t.marcheSousLotId)!.push(t);
  }

  // Get photo URLs for all tâches
  const photoUrlsByTache = new Map<string, string[]>();
  for (const t of tacheRows) {
    if (t.photos && t.photos.length > 0) {
      photoUrlsByTache.set(t.id, await getPhotoUrls(t.photos));
    }
  }

  // Group sousLots by marcheId
  const sousLotsByMarche = new Map<string, typeof sousLotRows>();
  for (const s of sousLotRows) {
    if (!sousLotsByMarche.has(s.marcheId)) sousLotsByMarche.set(s.marcheId, []);
    sousLotsByMarche.get(s.marcheId)!.push(s);
  }

  return marcheRows.map((m) => {
    const supplierName =
      m.supplierCompanyName ||
      [m.supplierFirstName, m.supplierLastName].filter(Boolean).join(' ') ||
      'Fournisseur';

    const sousLots = (sousLotsByMarche.get(m.id) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      marcheTypeLabel: s.marcheTypeLabel ?? null,
      // Retours 24/11 pt 1 : même ordre de statut qu'à l'écran.
      taches: sortByTacheStatus(tachesBySousLot.get(s.id) ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate ? String(t.dueDate) : null,
        locationDescription: t.locationDescription,
        roomName: t.roomName ?? null,
        levelName: t.levelName ?? null,
        photos: photoUrlsByTache.get(t.id) ?? [],
      })),
    }));

    return {
      id: m.id,
      name: m.name,
      typeLabel: m.marcheTypeLabel ?? null,
      supplierName,
      status: m.status,
      amountHt: m.amountHt ? String(m.amountHt) : null,
      sousLots,
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marcheId = searchParams.get('marcheId') ?? '';
  const lotId = searchParams.get('lotId') ?? '';
  const supplierId = searchParams.get('supplierId') ?? '';
  const propertyId = searchParams.get('propertyId') ?? '';

  let marcheIds: string[] = [];
  let title = 'Suivi de travaux';
  let subtitle: string | undefined;
  let address: string | undefined;
  // Pour un marché seul, le gros titre = « Marché <type> — <fournisseur> » (calculé après build).
  let singleMarche = false;

  if (UUID_RE.test(marcheId)) {
    marcheIds = [marcheId];
    singleMarche = true;
    const [p] = await db
      .select({
        address: properties.address,
        postalCode: properties.postalCode,
        city: properties.city,
      })
      .from(marchesTravaux)
      .innerJoin(properties, eq(properties.id, marchesTravaux.propertyId))
      .where(eq(marchesTravaux.id, marcheId))
      .limit(1);
    address = formatAddress(p);
  } else if (UUID_RE.test(lotId)) {
    // Trouver les marchés affectés à ce lot
    const affectations = await db
      .select({
        marcheId: marcheLotAffectations.marcheId,
        lotName: lots.name,
        propertyName: properties.name,
        address: properties.address,
        postalCode: properties.postalCode,
        city: properties.city,
      })
      .from(marcheLotAffectations)
      .leftJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
      .leftJoin(properties, eq(properties.id, lots.propertyId))
      .where(eq(marcheLotAffectations.lotId, lotId));
    marcheIds = affectations.map((a) => a.marcheId);
    const first = affectations[0];
    subtitle = first ? `${first.propertyName ?? ''} — ${first.lotName ?? ''}` : undefined;
    address = formatAddress(first);
  } else if (UUID_RE.test(supplierId)) {
    // Tous les marchés de ce fournisseur
    const rows = await db
      .select({ id: marchesTravaux.id, supplierName: suppliers.companyName })
      .from(marchesTravaux)
      .leftJoin(suppliers, eq(suppliers.id, marchesTravaux.supplierId))
      .where(eq(marchesTravaux.supplierId, supplierId));
    marcheIds = rows.map((r) => r.id);
    const name = rows[0]?.supplierName ?? 'Fournisseur';
    title = `Suivi de travaux — ${name}`;
  } else if (UUID_RE.test(propertyId)) {
    // Retours 24/11 pt 3 — tous les marchés ACTIFS du bien (un marché porte
    // toujours son propertyId ; les lots n'en sont que des affectations).
    const [p] = await db
      .select({
        name: properties.name,
        address: properties.address,
        postalCode: properties.postalCode,
        city: properties.city,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!p) return new Response('Bien introuvable', { status: 404 });
    const rows = await db
      .select({ id: marchesTravaux.id })
      .from(marchesTravaux)
      .where(and(eq(marchesTravaux.propertyId, propertyId), eq(marchesTravaux.isActive, true)));
    marcheIds = rows.map((r) => r.id);
    subtitle = p.name;
    address = formatAddress(p);
  } else {
    return new Response('Paramètre marcheId, lotId, supplierId ou propertyId requis', {
      status: 400,
    });
  }

  const marches = await buildMarcheNodes(marcheIds);
  if (singleMarche && marches[0]) subtitle = marcheHeading(marches[0]);

  const now = new Date();
  const generatedAt = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const nodeBuffer = await renderToBuffer(
    React.createElement(SuiviTravauxPDF, { marches, title, subtitle, address, generatedAt }),
  );
  const buffer = new Uint8Array(nodeBuffer);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="suivi-travaux.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

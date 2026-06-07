import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
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
import { eq, inArray, asc } from 'drizzle-orm';
import { getPresignedDownloadUrl } from '@/lib/storage/minio';
import { SuiviTravauxPDF, type PdfMarche } from '@/lib/pdf/suivi-travaux-pdf';

// dashboard-22 — API route PDF suivi de travaux
// GET /api/pdf/suivi-travaux?marcheId=<id>
// GET /api/pdf/suivi-travaux?lotId=<id>
// GET /api/pdf/suivi-travaux?supplierId=<id>

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function getPhotoUrls(keys: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const key of keys.slice(0, 4)) {
    try {
      const url = await getPresignedDownloadUrl(key, 3600);
      urls.push(url);
    } catch {
      // skip broken photo
    }
  }
  return urls;
}

async function buildMarcheNodes(marcheIds: string[]): Promise<PdfMarche[]> {
  if (marcheIds.length === 0) return [];

  const marcheRows = await db
    .select({
      id: marchesTravaux.id,
      name: marchesTravaux.name,
      status: marchesTravaux.status,
      amountHt: marchesTravaux.amountHt,
      supplierCompanyName: suppliers.companyName,
      supplierFirstName: suppliers.firstName,
      supplierLastName: suppliers.lastName,
    })
    .from(marchesTravaux)
    .leftJoin(suppliers, eq(suppliers.id, marchesTravaux.supplierId))
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
          .where(inArray(marcheTaches.marcheSousLotId, sousLotIds))
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
      taches: (tachesBySousLot.get(s.id) ?? []).map((t) => ({
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

  let marcheIds: string[] = [];
  let title = 'Suivi de travaux';
  let subtitle: string | undefined;

  if (UUID_RE.test(marcheId)) {
    marcheIds = [marcheId];
    title = 'Suivi de travaux — Marché';
  } else if (UUID_RE.test(lotId)) {
    // Trouver les marchés affectés à ce lot
    const affectations = await db
      .select({
        marcheId: marcheLotAffectations.marcheId,
        lotName: lots.name,
        propertyName: properties.name,
      })
      .from(marcheLotAffectations)
      .leftJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
      .leftJoin(properties, eq(properties.id, lots.propertyId))
      .where(eq(marcheLotAffectations.lotId, lotId));
    marcheIds = affectations.map((a) => a.marcheId);
    const first = affectations[0];
    title = 'Suivi de travaux';
    subtitle = first ? `${first.propertyName ?? ''} — ${first.lotName ?? ''}` : undefined;
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
  } else {
    return new Response('Paramètre marcheId, lotId ou supplierId requis', { status: 400 });
  }

  const marches = await buildMarcheNodes(marcheIds);

  const now = new Date();
  const generatedAt = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const nodeBuffer = await renderToBuffer(
    React.createElement(SuiviTravauxPDF, { marches, title, subtitle, generatedAt }),
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

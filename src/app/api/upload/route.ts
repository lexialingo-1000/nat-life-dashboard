import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPresignedUploadUrl, slugify, type StorageScope } from '@/lib/storage/minio';
import { createClient } from '@/lib/supabase/server';

const uploadRequestSchema = z.object({
  scope: z.enum([
    'companies',
    'suppliers',
    'customers',
    'properties',
    'lots',
    'marches',
    'locations',
  ]),
  parentSlug: z.string().min(1),
  parentId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
});

export async function POST(req: Request) {
  const bypassAuth = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';
  if (!bypassAuth) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(', ') },
      { status: 400 }
    );
  }

  const { scope, parentSlug, parentId, fileName } = parsed.data;

  const folder = scope.charAt(0).toUpperCase() + scope.slice(1) as Capitalize<StorageScope>;
  const safeFileName = slugify(fileName.replace(/\.[^.]+$/, '')) + (fileName.match(/\.[^.]+$/)?.[0] ?? '');
  const storageKey = `${folder}/${parentSlug}/${parentId}/${Date.now()}-${safeFileName}`;

  try {
    const uploadUrl = await getPresignedUploadUrl(storageKey, 600);
    return NextResponse.json({ uploadUrl, storageKey });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur MinIO' },
      { status: 500 }
    );
  }
}

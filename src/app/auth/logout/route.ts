import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${baseUrl}/login`, { status: 303 });
}

import { Sidebar } from '@/components/sidebar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | null = null;

  if (DEV_BYPASS) {
    userEmail = 'dev@nat-life.local';
  } else {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect('/login');
      }
      userEmail = user.email ?? null;
    } catch {
      // Supabase pas configuré : laisse passer en mode demo (sans email)
      userEmail = null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userEmail={userEmail} />
      <main className="flex-1 overflow-y-auto">
        {DEV_BYPASS && (
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50/70 px-8 py-2 text-[11px] text-emerald-900">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Mode développement : authentification bypassée. Retire{' '}
            <span className="kbd">NEXT_PUBLIC_DEV_BYPASS_AUTH</span> dans{' '}
            <span className="kbd">.env.local</span> pour réactiver Supabase Auth.
          </div>
        )}
        <div className="mx-auto max-w-[1280px] px-12 py-10">{children}</div>
      </main>
    </div>
  );
}

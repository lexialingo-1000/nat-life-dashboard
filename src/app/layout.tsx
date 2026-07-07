import type { Metadata, Viewport } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const display = Inter_Tight({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Nat Life · Gestion multi-société',
  description: 'Dashboard de gestion patrimoniale multi-société · Natacha Aouizerate (FKA Holding)',
  appleWebApp: {
    capable: true,
    title: 'Nat Life',
    // black-translucent : la status bar iOS se fond dans la topbar navy
    // (contenu sous la barre, compensé par pt-[safe-area-inset-top] sur la topbar).
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D2144',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

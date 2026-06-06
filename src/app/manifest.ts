import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nat Life · Gestion multi-société',
    short_name: 'Nat Life',
    description: 'Dashboard de gestion patrimoniale multi-société (FKA Holding)',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f1e8',
    theme_color: '#0D2144',
    lang: 'fr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

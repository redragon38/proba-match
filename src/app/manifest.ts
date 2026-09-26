import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Proba Match — Football',
    short_name: 'Proba Match',
    description: 'Matchs, statistiques et favoris football.',
    lang: 'fr',
    start_url: '/',
    display: 'standalone',
    background_color: '#111416',
    theme_color: '#171b1e',
    icons: [
      {
        src: '/brand/proba-match-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/proba-match-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}

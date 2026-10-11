import type { NextConfig } from 'next';
import { isPreviewDeployment } from './src/lib/deployment';
import { contentSecurityPolicy } from './src/lib/security-policy';
const config: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'media.api-sports.io' }],
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return ['probamatch.com', 'www.probamatch.com'].map((host) => ({
      source: '/:path*',
      has: [{ type: 'host' as const, value: host }],
      destination: 'https://proba-match.com/:path*',
      permanent: true,
    }));
  },
  async headers() {
    const publicHttps =
      process.env.NODE_ENV === 'production' &&
      process.env.VERCEL_ENV === 'production' &&
      !isPreviewDeployment() &&
      !!process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://');
    const cdn = (seconds: number, stale = seconds * 4) => [
      {
        key: 'Vercel-CDN-Cache-Control',
        value: `public, s-maxage=${seconds}, stale-while-revalidate=${stale}`,
      },
    ];
    return [
      // HTML is stable enough to stay at the edge. Live score patches are fetched
      // separately by the client, so a page cache hit never delays a goal update.
      { source: '/', headers: cdn(300, 1800) },
      { source: '/matchs', headers: cdn(300, 1800) },
      { source: '/match/:path*', headers: cdn(300, 1800) },
      { source: '/live', headers: cdn(300, 1800) },
      { source: '/joueurs', headers: cdn(300, 1800) },
      { source: '/joueur/:path*', headers: cdn(300, 1800) },
      { source: '/equipes', headers: cdn(300, 1800) },
      { source: '/equipe/:path*', headers: cdn(300, 1800) },
      { source: '/competitions', headers: cdn(300, 1800) },
      { source: '/competition/:path*', headers: cdn(300, 1800) },
      { source: '/classements', headers: cdn(300, 1800) },
      { source: '/comparateur/:path*', headers: cdn(300, 1800) },
      { source: '/a-propos', headers: cdn(86400, 604800) },
      { source: '/methodologie', headers: cdn(86400, 604800) },
      { source: '/comprendre-probabilites', headers: cdn(86400, 604800) },
      { source: '/lexique-football', headers: cdn(86400, 604800) },
      { source: '/sources-donnees', headers: cdn(86400, 604800) },
      { source: '/contact', headers: cdn(86400, 604800) },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      {
        source: '/api/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/api/cron/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy({
              development: process.env.NODE_ENV === 'development',
              publicHttps,
            }),
          },
          ...(publicHttps ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
          ...(isPreviewDeployment() ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
        ],
      },
    ];
  },
};
export default config;

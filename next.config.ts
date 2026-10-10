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
    return ['probamatch.com', 'www.probamatch.com', 'proba-match.com', 'www.proba-match.com'].map(
      (host) => ({
        source: '/:path*',
        has: [{ type: 'host' as const, value: host }],
        destination: 'https://proba-match.vercel.app/:path*',
        permanent: true,
      }),
    );
  },
  async headers() {
    const publicHttps =
      process.env.NODE_ENV === 'production' &&
      process.env.VERCEL_ENV === 'production' &&
      !isPreviewDeployment() &&
      !!process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://');
    return [
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

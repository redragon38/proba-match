/** Inline scripts remain necessary for Next hydration and client JSON-LD.
 * Google Analytics is the only allowed third-party script/connection. */
export function contentSecurityPolicy({ development = false, publicHttps = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://media.api-sports.io https://a.espncdn.com https://www.thesportsdb.com https://r2.thesportsdb.com https://upload.wikimedia.org https://thumb.wikimedia.org",
    "font-src 'self' data:",
    `connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com${development ? ' ws: wss:' : ''}`,
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(publicHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

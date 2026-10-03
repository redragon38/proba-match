/** Inline scripts remain necessary for Next hydration and client JSON-LD.
 * No eval in production; no third-party script, connection or frame origins. */
export function contentSecurityPolicy({ development = false, publicHttps = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://media.api-sports.io https://a.espncdn.com https://www.thesportsdb.com https://r2.thesportsdb.com https://upload.wikimedia.org https://thumb.wikimedia.org",
    "font-src 'self' data:",
    `connect-src 'self'${development ? ' ws: wss:' : ''}`,
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(publicHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

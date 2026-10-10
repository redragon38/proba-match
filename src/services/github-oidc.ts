import { z } from 'zod';

const headerSchema = z.object({ alg: z.literal('RS256'), kid: z.string().min(1).max(256) });
const claimsSchema = z.object({
  iss: z.literal('https://token.actions.githubusercontent.com'),
  aud: z.union([z.string().max(512), z.array(z.string().max(512)).max(10)]),
  exp: z.number().int(),
  nbf: z.number().int().optional(),
  repository: z.literal('redragon38/proba-match'),
  ref: z.string().max(512),
  event_name: z.enum(['schedule', 'workflow_dispatch']),
  workflow_ref: z.string().max(1024),
});
const jwksSchema = z.object({
  keys: z
    .array(
      z.object({
        kty: z.literal('RSA'),
        kid: z.string().max(256),
        n: z.string().max(4096),
        e: z.string().max(64),
        alg: z.string().optional(),
        use: z.string().optional(),
      }),
    )
    .max(100),
});

const decode = (part: string) => {
  const value = part.replaceAll('-', '+').replaceAll('_', '/');
  return Buffer.from(value.padEnd(Math.ceil(value.length / 4) * 4, '='), 'base64');
};

/** Verify a short-lived GitHub Actions OIDC token; no deploy secret is stored in the repository. */
export async function verifyGithubActionsOidc(token: string) {
  try {
    if (token.length < 100 || token.length > 16_384) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = headerSchema.parse(JSON.parse(decode(parts[0]).toString('utf8')));
    const claims = claimsSchema.parse(JSON.parse(decode(parts[1]).toString('utf8')));
    const now = Math.floor(Date.now() / 1000);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (
      !audience.includes('proba-match-realtime') ||
      claims.exp <= now ||
      claims.exp > now + 600 ||
      (claims.nbf != null && claims.nbf > now + 30) ||
      claims.ref !== 'refs/heads/master' ||
      !claims.workflow_ref.startsWith('redragon38/proba-match/.github/workflows/') ||
      !claims.workflow_ref.endsWith('@refs/heads/master')
    )
      return false;
    const response = await fetch('https://token.actions.githubusercontent.com/.well-known/jwks', {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const keys = jwksSchema.parse(await response.json()).keys;
    const key = keys.find((candidate) => candidate.kid === header.kid);
    if (!key) return false;
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { kty: key.kty, n: key.n, e: key.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      decode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}

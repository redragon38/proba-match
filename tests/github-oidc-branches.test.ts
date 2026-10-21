import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { verifyGithubActionsOidc } from '@/services/github-oidc';
let keys: CryptoKeyPair;
let jwk: JsonWebKey;
beforeAll(async () => {
  keys = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
});
afterEach(() => vi.unstubAllGlobals());
async function token(ref: string, overrides = {}) {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const input = `${enc({ alg: 'RS256', kid: 'test-only' })}.${enc({ iss: 'https://token.actions.githubusercontent.com', aud: 'proba-match-realtime', exp: now + 300, nbf: now - 1, repository: 'redragon38/proba-match', ref, event_name: 'workflow_dispatch', workflow_ref: `redragon38/proba-match/.github/workflows/football-realtime.yml@${ref}`, ...overrides })}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keys.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}
it.each(['main', 'master'])(
  'accepts an authentic workflow token for the trusted %s branch',
  async (branch) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: 'test-only' }] })),
    );
    expect(await verifyGithubActionsOidc(await token(`refs/heads/${branch}`))).toBe(true);
  },
);
it('rejects other branches, mixed branch claims and a forged signature', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: 'test-only' }] })),
  );
  expect(await verifyGithubActionsOidc(await token('refs/heads/untrusted'))).toBe(false);
  expect(
    await verifyGithubActionsOidc(
      await token('refs/heads/main', {
        workflow_ref:
          'redragon38/proba-match/.github/workflows/football-realtime.yml@refs/heads/master',
      }),
    ),
  ).toBe(false);
  const valid = await token('refs/heads/main');
  const parts = valid.split('.');
  parts[2] = 'AAAA' + parts[2].slice(4);
  expect(await verifyGithubActionsOidc(parts.join('.'))).toBe(false);
});

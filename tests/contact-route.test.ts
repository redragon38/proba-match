import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../src/app/api/contact/route';

const valid = {
  name: 'Alex Martin',
  email: 'alex@example.com',
  reason: 'Proposition de collaboration',
  subject: 'Partenariat médias',
  message: 'Bonjour, je souhaite discuter d’un partenariat avec vous.',
};

function request(body: unknown, origin = 'https://proba-match.com') {
  return new Request('https://proba-match.com/api/contact', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('contact delivery', () => {
  it('rejects a cross-origin submission', async () => {
    expect((await POST(request(valid, 'https://example.com'))).status).toBe(403);
  });

  it('validates the message without sending', async () => {
    expect((await POST(request({ ...valid, message: 'court' }))).status).toBe(400);
  });

  it('reports a missing Formspree form without claiming success', async () => {
    vi.stubEnv('FORMSPREE_FORM_ID', '');
    expect((await POST(request(valid))).status).toBe(503);
  });

  it('sends a valid message to Formspree', async () => {
    vi.stubEnv('FORMSPREE_FORM_ID', 'abcdefgh');
    vi.stubEnv('DATABASE_URL', '');
    const send = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', send);
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      'https://formspree.io/f/abcdefgh',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(Object.fromEntries(send.mock.calls[0][1].body)).toMatchObject(valid);
  });

  it('does not claim delivery when Formspree rejects the message', async () => {
    vi.stubEnv('FORMSPREE_FORM_ID', 'abcdefgh');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 422 })));
    expect((await POST(request({ ...valid, email: 'alex2@example.com' }))).status).toBe(502);
  });
});

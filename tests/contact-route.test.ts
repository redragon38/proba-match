import { afterEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

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
  sendMail.mockReset();
});

describe('contact delivery', () => {
  it('rejects a cross-origin submission', async () => {
    expect((await POST(request(valid, 'https://example.com'))).status).toBe(403);
  });

  it('validates the message without sending', async () => {
    expect((await POST(request({ ...valid, message: 'court' }))).status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('reports missing mail credentials without claiming success', async () => {
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_APP_PASSWORD', '');
    expect((await POST(request(valid))).status).toBe(503);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends a valid message to the fixed contact address', async () => {
    vi.stubEnv('SMTP_USER', 'probamatch@gmail.com');
    vi.stubEnv('SMTP_APP_PASSWORD', 'test-app-password');
    vi.stubEnv('DATABASE_URL', '');
    sendMail.mockResolvedValue({ messageId: 'test' });
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'probamatch@gmail.com',
      replyTo: { name: valid.name, address: valid.email },
    }));
  });
});

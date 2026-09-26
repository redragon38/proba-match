import { describe, expect, it } from 'vitest';
import { readJsonBody } from '@/lib/request-body';

const request = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://example.test/api/admin/session', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
describe('Bounded JSON requests', () => {
  it('accepts valid JSON and rejects malformed content without leaking it', async () => {
    expect(await readJsonBody(request('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } });
    const result = await readJsonBody(request('private-invalid-value'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.text()).not.toContain('private-invalid-value');
    }
  });
  it('requires the JSON content type', async () => {
    const result = await readJsonBody(request('{}', { 'content-type': 'text/plain' }));
    expect(!result.ok && result.response.status).toBe(415);
  });
  it('rejects excess bytes even with missing or false Content-Length', async () => {
    const headerCases: Record<string, string>[] = [
      {},
      { 'content-length': '1' },
      { 'content-length': '99999' },
    ];
    for (const headers of headerCases) {
      const result = await readJsonBody(
        request(JSON.stringify({ value: 'é'.repeat(20) }), headers),
        32,
      );
      expect(!result.ok && result.response.status).toBe(413);
    }
  });
  it('cancels an oversized streamed body without waiting for the sender to finish', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(33)));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamedRequest = new Request('https://example.test', {
      method: 'POST',
      body: stream,
      duplex: 'half',
      headers: { 'content-type': 'application/json' },
    } as RequestInit);
    const result = await readJsonBody(streamedRequest, 32);
    expect(!result.ok && result.response.status).toBe(413);
    expect(cancelled).toBe(true);
  });
});

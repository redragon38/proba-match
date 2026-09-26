type JsonBodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

/** Bound the bytes read as well as Content-Length, which callers can omit or falsify. */
export async function readJsonBody(request: Request, maxBytes = 4096): Promise<JsonBodyResult> {
  const invalid = (status: number, error: string): JsonBodyResult => ({
    ok: false,
    response: Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } }),
  });
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return invalid(415, 'Un contenu JSON est requis.');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    return invalid(Number(length) > maxBytes ? 413 : 400, 'Taille de requête invalide.');
  if (!request.body) return invalid(400, 'Requête JSON invalide.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return invalid(413, 'Requête trop volumineuse.');
      }
      chunks.push(value);
    }
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return invalid(400, 'Requête JSON invalide.');
  } finally {
    reader.releaseLock();
  }
}

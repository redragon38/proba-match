/** Public publisher details only: never infer a person's identity or address. */
export function legalConfig(env: Record<string, string | undefined> = process.env) {
  const text = (key: string) => env[key]?.trim() || null;
  const candidate = text('CONTACT_EMAIL');
  const contact = candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
  return {
    editor: text('LEGAL_EDITOR_NAME'),
    director: text('LEGAL_PUBLICATION_DIRECTOR'),
    address: text('LEGAL_EDITOR_ADDRESS'),
    contact,
    registration: text('LEGAL_REGISTRATION'),
    host: text('LEGAL_HOST_NAME') ?? 'Vercel',
    hostAddress: text('LEGAL_HOST_ADDRESS'),
    retention: text('LEGAL_LOG_RETENTION'),
  };
}

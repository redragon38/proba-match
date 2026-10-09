/** Prisma v6's pool is per process, not shared across Vercel instances. */
export function selectedDatabaseUrl(
  environment: Record<string, string | undefined> = process.env,
) {
  if (environment.USE_AIVEN_DATABASE === 'true') return environment.AIVEN_DATABASE_URL;
  return environment.DATABASE_URL;
}

export function runtimeDatabaseUrl(value: string | undefined, vercel: boolean) {
  if (!value || !vercel) return value;
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return value;
    url.searchParams.set('connection_limit', '1');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '10');
    return url.toString();
  } catch {
    // Let Prisma report an invalid configuration through the existing safe diagnostics.
    return value;
  }
}

/** Prisma v6's pool is per process, not shared across runtime processes. */
export function selectedDatabaseUrl(
  environment: Record<string, string | undefined> = process.env,
) {
  if (environment.USE_AIVEN_DATABASE === 'true') return environment.AIVEN_DATABASE_URL;
  return environment.DATABASE_URL;
}

export function runtimeDatabaseUrl(
  value: string | undefined,
  constrained: boolean,
  connectionLimit = 1,
) {
  if (!value || !constrained) return value;
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return value;
    url.searchParams.set('connection_limit', String(connectionLimit));
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '10');
    return url.toString();
  } catch {
    // Let Prisma report an invalid configuration through the existing safe diagnostics.
    return value;
  }
}

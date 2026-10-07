type LogFields = {
  code?: string;
  errorType?: string;
  operation?: string;
  reason?: string;
  durationMs?: number;
  count?: number;
  runId?: string;
};
export function log(event: string, fields: LogFields = {}) {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

/** Never serialize an exception, its message, URL, metadata or query parameters. */
export function databaseErrorFields(error: unknown) {
  const value = error as { name?: unknown; code?: unknown; errorCode?: unknown; message?: unknown } | null;
  const names = [
    'PrismaClientInitializationError',
    'PrismaClientKnownRequestError',
    'PrismaClientUnknownRequestError',
    'PrismaClientValidationError',
    'PrismaClientRustPanicError',
    'TypeError',
    'SyntaxError',
    'Error',
  ];
  const errorType = names.includes(String(value?.name)) ? String(value?.name) : 'UnknownError';
  const candidate = value?.code ?? value?.errorCode;
  const code =
    typeof candidate === 'string' &&
    /^(P\d{4}|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND)$/.test(candidate)
      ? candidate
      : 'UNCLASSIFIED';
  const message = typeof value?.message === 'string' ? value.message : '';
  const reasons: [RegExp, string][] = [
    [/could not locate the Query Engine|Query engine library.*not found/i, 'ENGINE_NOT_FOUND'],
    [/Unable to require|libssl|libcrypto|GLIBC|invalid ELF/i, 'ENGINE_LOAD_FAILED'],
    [/Authentication failed|password authentication failed/i, 'DATABASE_AUTH_FAILED'],
    [/Can.t reach database server|Connection refused|connect timeout/i, 'DATABASE_UNREACHABLE'],
    [/Environment variable not found/i, 'DATABASE_ENV_MISSING'],
    [/invalid.*connection string|URL must start|invalid port number/i, 'DATABASE_URL_INVALID'],
    [/too many connections|remaining connection slots/i, 'DATABASE_CONNECTION_LIMIT'],
    [/TLS|SSL connection/i, 'DATABASE_TLS_FAILED'],
  ];
  const reason = reasons.find(([pattern]) => pattern.test(message))?.[1];
  return { errorType, code, ...(reason ? { reason } : {}) };
}

type LogFields = {
  code?: string;
  errorType?: string;
  operation?: string;
  durationMs?: number;
  count?: number;
  runId?: string;
};
export function log(event: string, fields: LogFields = {}) {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

/** Never serialize an exception, its message, URL, metadata or query parameters. */
export function databaseErrorFields(error: unknown) {
  const value = error as { name?: unknown; code?: unknown; errorCode?: unknown } | null;
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
  return { errorType, code };
}

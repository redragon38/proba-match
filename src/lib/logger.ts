type LogFields = { code?: string; durationMs?: number; count?: number; runId?: string };
export function log(event: string, fields: LogFields = {}) {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

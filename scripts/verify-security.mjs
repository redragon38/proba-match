import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.VERIFY_URL || 'http://localhost:3000';
const baseline = process.argv.includes('--baseline');
const origin = new URL(base).origin;
const checks = [];
async function check(path, expected, init = {}, inspect) {
  const response = await fetch(new URL(path, base), {
    ...init,
    signal: AbortSignal.timeout(30000),
    redirect: 'manual',
  });
  const body = await response.text();
  const errors = [];
  if (response.status !== expected) errors.push(`HTTP ${response.status}, attendu ${expected}`);
  if (response.headers.get('access-control-allow-origin') === '*')
    errors.push('CORS privé trop permissif');
  if (
    /DATABASE_URL|ADMIN_SECRET|CRON_SECRET|PrismaClientKnownRequestError|node_modules[\\/]/.test(
      body,
    )
  )
    errors.push('Réponse divulguant des détails serveur');
  await inspect?.(response, body, errors);
  checks.push({ path, method: init.method || 'GET', status: response.status, errors });
}
await check('/admin', 200, {}, (response, body, errors) => {
  if (!body.includes('id="admin-secret"')) errors.push('Formulaire de connexion absent');
  if (body.includes('Les coulisses de MatchScore')) errors.push('Vue admin privée exposée');
  if (response.headers.get('x-frame-options') !== 'DENY') errors.push('Protection iframe absente');
  if (response.headers.get('x-content-type-options') !== 'nosniff')
    errors.push('Protection MIME absente');
  if (!baseline) {
    const csp = response.headers.get('content-security-policy') || '';
    for (const directive of [
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ])
      if (!csp.includes(directive)) errors.push(`CSP absente : ${directive}`);
  }
});
for (const path of ['sync', 'live', 'fixtures', 'openfootball', 'standings'])
  await check(`/api/cron/${path}`, 401);
if (!baseline) await check('/api/health', 401);
for (const path of ['sync', 'mapping'])
  await check(`/api/admin/${path}`, 401, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{}',
  });
for (const path of ['reconstruct-aiven', 'reconstruct-aiven-direct']) {
  await check(`/api/admin/${path}`, 405);
  await check(`/api/admin/${path}?token=query-secrets-are-never-accepted`, 401, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}
for (const method of ['POST', 'DELETE'])
  await check('/api/admin/session', 403, {
    method,
    headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
await check('/api/matches?date=2026-02-30', 400);
await check(
  '/api/search?q=' + encodeURIComponent('<script>alert(1)</script>'),
  200,
  {},
  (response, body, errors) => {
    if (!response.headers.get('content-type')?.includes('application/json'))
      errors.push('Recherche non JSON');
    if (!Array.isArray(JSON.parse(body).results)) errors.push('Structure de recherche invalide');
  },
);
await check('/api/search?q=' + 'x'.repeat(101), 200, {}, (_response, body, errors) => {
  if (JSON.parse(body).results.length) errors.push('Recherche trop longue non rejetée');
});
await mkdir('artifacts', { recursive: true });
const report = {
  at: new Date().toISOString(),
  base,
  baseline,
  checks,
  failures: checks.filter((item) => item.errors.length).length,
};
await writeFile(
  `artifacts/security-http${baseline ? '-baseline' : ''}.json`,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ checks: checks.length, failures: report.failures, baseline }));
if (report.failures) {
  console.error(
    JSON.stringify(
      checks.filter((item) => item.errors.length),
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

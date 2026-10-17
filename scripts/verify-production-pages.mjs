const origin = new URL(process.env.VERIFY_URL || 'http://127.0.0.1:3000').origin;
const paths = [
  '/',
  '/matchs',
  '/live',
  '/classements',
  '/equipes',
  '/joueurs',
  '/competitions',
  '/comparateur/equipes',
  '/favoris',
  '/parametres',
  '/contact',
  '/a-propos',
  '/methodologie',
  '/sources-donnees',
  '/comprendre-probabilites',
  '/confidentialite',
  '/cookies',
  '/mentions-legales',
  '/recherche',
  '/joueurs?page=61',
  '/equipes?page=6',
];

async function probe(path) {
  const started = performance.now();
  try {
    const response = await fetch(`${origin}${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'ProbaMatch-Production-Smoke/1.0' },
    });
    const body = await response.text();
    const gatewayPage = /(?:502 Bad Gateway|504 Gateway Time-out|nginx\/\d)/i.test(body);
    const allowed = path.includes('?page=') ? [200, 404] : [200];
    return {
      path,
      status: response.status,
      ms: Math.round(performance.now() - started),
      cache: response.headers.get('x-proba-cache'),
      pass: allowed.includes(response.status) && !gatewayPage && body.length > 100,
    };
  } catch (error) {
    return {
      path,
      status: 0,
      ms: Math.round(performance.now() - started),
      cache: null,
      pass: false,
      error: error instanceof Error ? error.name : 'REQUEST_FAILED',
    };
  }
}

const results = [];
for (let start = 0; start < paths.length; start += 4) {
  results.push(...(await Promise.all(paths.slice(start, start + 4).map(probe))));
}
console.table(results);
if (results.some((result) => !result.pass)) process.exitCode = 1;

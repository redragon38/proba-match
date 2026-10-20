/** Read-only, bounded crawl. No sports-provider requests, cookies or authentication. */
export const monitorSeeds = [
  '/',
  '/matchs',
  '/competitions',
  '/equipes',
  '/joueurs',
  '/classements',
  '/analyses',
  '/methodologie',
  '/comprendre-probabilites',
  '/lexique-football',
  '/sources-donnees',
  '/comparateur/equipes',
];

const decode = (text = '') =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const text = (html = '') =>
  decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [
      m[1].toLowerCase(),
      decode(m[2] ?? m[3] ?? m[4]),
    ]),
  );
}
export function inspectHtml(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attributes(m[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attributes(m[0]));
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
    (m) => attributes(m[1]).type === 'application/ld+json',
  );
  const structured = [];
  let invalidJson = false;
  for (const script of scripts) {
    try {
      structured.push(JSON.parse(script[2]));
    } catch {
      invalidJson = true;
    }
  }
  const body = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  return {
    title: text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    description: metas.find((m) => m.name?.toLowerCase() === 'description')?.content ?? '',
    robots: metas
      .filter((m) => ['robots', 'googlebot'].includes(m.name?.toLowerCase()))
      .map((m) => m.content)
      .join(','),
    canonical: links.find((m) => m.rel?.toLowerCase().split(/\s+/).includes('canonical'))?.href,
    h1: [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1])),
    language: attributes(html.match(/<html\b[^>]*>/i)?.[0] ?? '').lang,
    mainLength: text(body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]).length,
    links: [...body.matchAll(/<a\b[^>]*>/gi)].map((m) => attributes(m[0]).href).filter(Boolean),
    structured,
    invalidJson,
    publishedAt: html.match(/data-football-updated-at="([^"]+)"/)?.[1],
  };
}

/** @param {{baseUrl: string, canonicalOrigin?: string, maxPages?: number, delayMs?: number, timeoutMs?: number, fetchImpl?: typeof fetch, previousCount?: number, maxSitemapFiles?: number, now?: number}} options */
export async function crawlSeo({
  baseUrl,
  canonicalOrigin = new URL(baseUrl).origin,
  maxPages = 60,
  delayMs = 200,
  timeoutMs = 12000,
  fetchImpl = fetch,
  previousCount,
  maxSitemapFiles = 20,
  now = Date.now(),
}) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password)
    throw new Error('INVALID_MONITOR_ORIGIN');
  if (!Number.isFinite(maxPages) || maxPages < 1 || !Number.isFinite(delayMs) || delayMs < 0)
    throw new Error('INVALID_MONITOR_LIMIT');
  maxPages = Math.min(10000, Math.floor(maxPages));
  const canonical = new URL(canonicalOrigin).origin;
  const issues = [],
    pages = [],
    sitemapUrls = new Set(),
    discovered = new Set();
  const add = (severity, code, url, detail) => issues.push({ severity, code, url, detail });
  const request = async (url) => {
    const started = performance.now();
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    // Follow at most four same-origin redirects, never arbitrary external URLs.
    let target = new URL(url, base),
      redirected = false;
    for (let redirects = 0; redirects < 5; redirects++) {
      if (target.origin !== base.origin) throw new Error('EXTERNAL_REDIRECT');
      const response = await fetchImpl(target.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'ProbaMatchSEO/1.0 (+technical-monitor)' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('INVALID_REDIRECT');
        target = new URL(location, target);
        redirected = true;
        continue;
      }
      const reader = response.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > 8_000_000) throw new Error('RESPONSE_TOO_LARGE');
            chunks.push(chunk.value);
          }
        } finally {
          await reader.cancel();
        }
      }
      return {
        status: response.status,
        html: Buffer.concat(chunks).toString('utf8'),
        durationMs: Math.round(performance.now() - started),
        redirected,
        robots: response.headers.get('x-robots-tag') ?? '',
      };
    }
    throw new Error('REDIRECT_LOOP');
  };
  let robots = '';
  try {
    const response = await request('/robots.txt');
    robots = response.html;
    if (response.status !== 200) add('error', 'ROBOTS_HTTP', '/robots.txt', response.status);
    if (/^Disallow:\s*\/\s*$/im.test(robots)) add('error', 'ROBOTS_BLOCKS_SITE', '/robots.txt');
    if (!robots.includes(`Sitemap: ${canonical}/sitemap.xml`))
      add('error', 'ROBOTS_SITEMAP', '/robots.txt', 'Canonical sitemap declaration missing');
  } catch {
    add('error', 'ROBOTS_UNREACHABLE', '/robots.txt');
  }
  const pendingMaps = ['/sitemap.xml'],
    visitedMaps = new Set();
  while (pendingMaps.length && visitedMaps.size < maxSitemapFiles) {
    const path = pendingMaps.shift();
    if (visitedMaps.has(path)) continue;
    visitedMaps.add(path);
    try {
      const response = await request(path);
      if (response.status !== 200 || !/<(?:urlset|sitemapindex)\b/.test(response.html)) {
        add('error', 'SITEMAP_INVALID', path, response.status);
        continue;
      }
      const locations = [...response.html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((m) =>
        decode(m[1].trim()),
      );
      if (locations.length > 50000) add('error', 'SITEMAP_LIMIT', path, locations.length);
      for (const modified of response.html.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
        const at = Date.parse(modified[1]);
        if (!Number.isFinite(at) || at > now + 60000)
          add('error', 'SITEMAP_LASTMOD', path, modified[1]);
      }
      const index = /<sitemapindex\b/.test(response.html);
      for (const location of locations) {
        const url = new URL(location);
        if (url.origin !== canonical || url.hash) {
          add('error', 'SITEMAP_ORIGIN', path, location);
          continue;
        }
        const local = url.pathname + url.search;
        if (index) pendingMaps.push(local);
        else {
          if (sitemapUrls.has(local)) add('error', 'SITEMAP_DUPLICATE', local);
          sitemapUrls.add(local);
        }
      }
    } catch {
      add('error', 'SITEMAP_UNREACHABLE', path);
    }
  }
  if (pendingMaps.length) add('warning', 'SITEMAP_TRUNCATED', '/sitemap.xml');
  if (
    Number.isFinite(previousCount) &&
    previousCount > 0 &&
    Math.abs(sitemapUrls.size - previousCount) / previousCount > 0.25
  )
    add('warning', 'INDEXABLE_VOLUME_CHANGED', '/sitemap.xml', {
      previousCount,
      count: sitemapUrls.size,
    });
  const queue = [...monitorSeeds];
  // Ensure representative entity pages are checked early, rather than exhausting
  // the budget on one catalogue or a sequence of match UUIDs.
  const groups = new Map();
  for (const path of sitemapUrls) {
    const key = path.split('?')[0].split('/')[1];
    const group = groups.get(key) ?? [];
    group.push(path);
    groups.set(key, group);
  }
  let representatives = 0;
  for (let i = 0; i < maxPages && representatives < Math.max(8, Math.floor(maxPages / 2)); i++)
    for (const group of groups.values()) {
      if (group[i] && !queue.includes(group[i])) {
        queue.push(group[i]);
        representatives++;
      }
      if (representatives >= Math.max(8, Math.floor(maxPages / 2))) break;
    }
  const seen = new Set(),
    titles = new Map(),
    descriptions = new Map();
  while (queue.length && pages.length < maxPages) {
    const path = queue.shift();
    if (!path) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      const response = await request(path);
      if (response.status !== 200) {
        add('error', 'PAGE_HTTP', path, response.status);
        pages.push({ path, status: response.status });
        continue;
      }
      const info = inspectHtml(response.html);
      const noindex = /\bnoindex\b/i.test(info.robots + ',' + response.robots);
      const row = {
        path,
        status: response.status,
        durationMs: response.durationMs,
        bytes: Buffer.byteLength(response.html),
        title: info.title,
        description: info.description,
        canonical: info.canonical,
        noindex,
        h1: info.h1,
        publishedAt: info.publishedAt,
      };
      pages.push(row);
      if (sitemapUrls.has(path) && noindex) add('error', 'SITEMAP_NOINDEX', path);
      if (sitemapUrls.has(path) && response.redirected) add('error', 'SITEMAP_REDIRECT', path);
      if (response.redirected) add('warning', 'INTERNAL_REDIRECT', path);
      if (!info.title) add('error', 'TITLE_MISSING', path);
      if (!info.description) add('error', 'DESCRIPTION_MISSING', path);
      if (info.h1.length !== 1) add('error', 'H1_COUNT', path, info.h1.length);
      if (!info.language?.startsWith('fr')) add('error', 'LANGUAGE', path, info.language);
      if (info.mainLength < 80) add('warning', 'MAIN_CONTENT_SHORT', path, info.mainLength);
      if (info.invalidJson) add('error', 'JSONLD_INVALID', path);
      const structured = [...info.structured];
      const allowedStatuses = [
        'EventCancelled',
        'EventMovedOnline',
        'EventPostponed',
        'EventRescheduled',
        'EventScheduled',
      ].map((name) => `https://schema.org/${name}`);
      while (structured.length) {
        const node = structured.pop();
        if (!node || typeof node !== 'object') continue;
        if (node.eventStatus && !allowedStatuses.includes(node.eventStatus))
          add('error', 'JSONLD_EVENT_STATUS', path, node.eventStatus);
        for (const value of Object.values(node))
          if (value && typeof value === 'object')
            structured.push(...(Array.isArray(value) ? value : [value]));
      }
      if (info.publishedAt) {
        const age = now - Date.parse(info.publishedAt);
        if (age > 86400000) add('warning', 'DATA_SNAPSHOT_OLD', path, Math.round(age / 3600000));
        if (age < -300000) add('warning', 'DATA_SNAPSHOT_FUTURE', path);
      }
      if (!info.canonical) add('error', 'CANONICAL_MISSING', path);
      else {
        const url = new URL(info.canonical);
        if (url.origin !== canonical) add('error', 'CANONICAL_ORIGIN', path, info.canonical);
        if (sitemapUrls.has(path) && url.pathname + url.search !== path)
          add('error', 'SITEMAP_NONCANONICAL', path, info.canonical);
      }
      if (!noindex)
        for (const [value, map, code] of [
          [info.title, titles, 'TITLE_DUPLICATE'],
          [info.description, descriptions, 'DESCRIPTION_DUPLICATE'],
        ]) {
          if (value && map.has(value)) add('warning', code, path, map.get(value));
          else if (value) map.set(value, path);
        }
      for (const href of info.links) {
        let url;
        try {
          url = new URL(href, new URL(path, base));
        } catch {
          continue;
        }
        if (![base.origin, canonical].includes(url.origin)) continue;
        if (/^\/(api|admin)(\/|$)|\/calendrier$|\.(png|svg|webp|ico|ics)$/i.test(url.pathname))
          continue;
        const local = url.pathname + url.search;
        // One canonical variant per crawl prevents unbounded filter/calendar spaces.
        if (url.search && !/^\?(?:page|saison)=\d+$/.test(url.search)) continue;
        if (url.pathname === path.split('?')[0] && url.hash) continue;
        discovered.add(local);
        if (!seen.has(local)) queue.push(local);
      }
    } catch (error) {
      pages.push({ path, status: 0 });
      add(
        'error',
        error.message === 'RESPONSE_TOO_LARGE' ? 'PAGE_TOO_LARGE' : 'PAGE_UNREACHABLE',
        path,
      );
    }
  }
  const sampled = sitemapUrls.size > pages.filter((p) => sitemapUrls.has(p.path)).length;
  return {
    generatedAt: new Date(now).toISOString(),
    base: base.origin,
    canonicalOrigin: canonical,
    scope: sampled ? 'bounded sample; not a complete crawl' : 'complete sitemap coverage',
    sitemapCount: sitemapUrls.size,
    sitemapFiles: visitedMaps.size,
    pages,
    discoveredLinks: discovered.size,
    orphanCandidates: [...sitemapUrls].filter((path) => path !== '/' && !discovered.has(path)),
    orphanScope: 'Candidates only: unvisited pages may contain additional inbound links.',
    issues,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
  };
}

export function monitorMarkdown(report) {
  return [
    `# Contrôle SEO — ${report.generatedAt}`,
    '',
    `Périmètre : ${report.scope}. Sitemap : ${report.sitemapCount} URL. Pages contrôlées : ${report.pages.length}.`,
    `Erreurs : ${report.errors}. Avertissements : ${report.warnings}.`,
    '',
    ...report.issues.map(
      (i) =>
        `- ${i.severity.toUpperCase()} ${i.code} : ${i.url}${i.detail === undefined ? '' : ' — ' + JSON.stringify(i.detail)}`,
    ),
    '',
    'Les candidats orphelins ne sont pas des orphelins confirmés sans exploration complète.',
    'Aucun accès Search Console ni mesure des Core Web Vitals terrain dans ce rapport.',
    '',
  ].join('\n');
}

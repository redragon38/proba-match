import type { Metadata } from 'next';
import type { Dataset, Match } from '@/types/football';
import { isPreviewDeployment } from './deployment';
import { sanitizeMatchStatistics } from './statistic-values';
import { validResult } from '@/prediction-engine/availability';

/** One origin for metadata, JSON-LD, robots and sitemap; never trust a request Host. */
export function siteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string {
  // Existing Vercel projects may still carry the former public-origin variable.
  const configured = ['https://probamatch.com', 'https://www.probamatch.com'].includes(value ?? '')
    ? 'https://proba-match.vercel.app'
    : value;
  const url = new URL(
    configured ||
      (process.env.VERCEL_ENV === 'production'
        ? 'https://proba-match.vercel.app'
        : 'http://localhost:3000'),
  );
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    (process.env.VERCEL_ENV === 'production' &&
      (local ||
        (url.hostname.endsWith('.vercel.app') && url.hostname !== 'proba-match.vercel.app')))
  ) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL must be an HTTPS origin (HTTP is allowed only on localhost).',
    );
  }
  return url.origin;
}
export function absoluteUrl(path: string) {
  return new URL(path, `${siteOrigin()}/`).href;
}
export function seoMetadata(
  path: string,
  title: string,
  description: string,
  index?: boolean,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    ...(isPreviewDeployment()
      ? { robots: { index: false, follow: false } }
      : index === undefined
        ? {}
        : {
            robots: {
              index,
              follow: true,
              ...(index
                ? {
                    'max-image-preview': 'large' as const,
                    'max-snippet': -1,
                    'max-video-preview': -1,
                  }
                : {}),
            },
          }),
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      locale: 'fr_FR',
      siteName: 'Proba Match',
      type: 'website',
      images: [
        {
          url: absoluteUrl('/opengraph-image'),
          width: 1200,
          height: 630,
          alt: 'Proba Match — statistiques et analyses football',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteUrl('/opengraph-image')],
    },
  };
}
export const publicPages: Record<string, [string, string]> = {
  '/': [
    'Proba Match — scores, calendrier et statistiques football',
    'Retrouvez les matchs du jour, les résultats, les classements et les analyses football de Proba Match. Sources identifiées et projections expliquées.',
  ],
  '/matchs': [
    'Matchs de football — scores et calendrier',
    'Consultez le calendrier et les résultats des compétitions suivies. Parcourez les dates, les équipes et les détails de chaque rencontre.',
  ],
  '/live': [
    'Scores de football en direct',
    'Suivez les rencontres en cours et les derniers scores disponibles. La source et la fraîcheur des données sont indiquées, sans simulation de direct.',
  ],
  '/equipes': [
    'Équipes de football — résultats et statistiques',
    'Explorez les clubs du catalogue Proba Match : forme récente, résultats, calendrier et statistiques disponibles pour chaque équipe.',
  ],
  '/joueurs': [
    'Joueurs — profils et performances individuelles',
    'Consultez les profils, les statistiques et les performances des joueurs disponibles dans le catalogue synchronisé Proba Match.',
  ],
  '/competitions': [
    'Compétitions de football — calendrier et classement',
    'Explorez les compétitions suivies par Proba Match, leurs équipes, leurs rencontres et leurs classements par saison.',
  ],
  '/classements': [
    'Classements de football par compétition et saison',
    'Comparez points, buts et forme des équipes. Consultez les classements par saison, à domicile, à l’extérieur et sur les cinq derniers matchs.',
  ],
  '/a-propos': [
    'À propos de Proba Match',
    'Découvrez Proba Match, une plateforme gratuite de statistiques football : origine des données, transparence des analyses et limites des projections.',
  ],
  '/methodologie': [
    'Méthodologie — sources et modèle Elo–Poisson',
    'Comprenez les sources OpenFootball, ESPN et API-Football, le modèle Elo–Poisson, les probabilités et les limites des analyses Proba Match.',
  ],
  '/lexique-football': [
    'Lexique football — probabilités, xG, Elo et statistiques',
    'Définitions simples de 28 termes football : 1N2, xG, xGOT, xA, PPDA, field tilt, xT et Elo. Méthodes de calcul et limites expliquées.',
  ],
  '/sources-donnees': [
    'Sources des données football et limites de couverture',
    'Origine des résultats et statistiques Proba Match : OpenFootball, ESPN et enrichissement API-Football. Synchronisation, données manquantes et limites.',
  ],
  '/comprendre-probabilites': [
    'Comprendre les probabilités et statistiques football',
    'Probabilité 1N2, buts attendus, score le plus probable et confiance : des exemples simples pour lire les statistiques football sans fausse certitude.',
  ],
};
export const editorialPaths = [
  '/a-propos',
  '/methodologie',
  '/comprendre-probabilites',
  '/lexique-football',
  '/sources-donnees',
];
export function publicMetadata(path: string, index?: boolean) {
  const [title, description] = publicPages[path];
  return seoMetadata(
    path,
    title,
    description,
    index ?? (editorialPaths.includes(path) ? true : undefined),
  );
}
export const catalogueSize = 24;
export function catalogueMetadata(
  path: string,
  count: number,
  page: number,
  real: boolean,
  search = '',
) {
  const [title, description] = publicPages[path];
  const term = search.slice(0, 100);
  const query = new URLSearchParams({
    ...(page > 1 ? { page: String(page) } : {}),
    ...(term ? { q: term } : {}),
  });
  const pageTitle = page === 1 ? title : `${title} — page ${page}`;
  return seoMetadata(
    `${path}${query.size ? `?${query}` : ''}`,
    term ? `${pageTitle} — recherche « ${term} »` : pageTitle,
    term
      ? `Recherche « ${term} » : ${count} résultat${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''} sur Proba Match.${page > 1 ? ` Page ${page} sur ${Math.ceil(count / catalogueSize)}.` : ''}`
      : page === 1
        ? description
        : `${description} Page ${page} sur ${Math.ceil(count / catalogueSize)}.`,
    real && !term && count > 0,
  );
}
export function matchIndexable(match: Match, data?: Dataset | ReadonlySet<string>) {
  return (
    match.events.length > 0 ||
    match.lineups.length > 0 ||
    (match.status !== 'scheduled' && sanitizeMatchStatistics(match.statistics).length > 0) ||
    (validResult(match) &&
      !!data &&
      ('matches' in data
        ? [match.homeId, match.awayId].every(
            (id) =>
              data.matches.filter(
                (m) =>
                  m.id !== match.id &&
                  validResult(m) &&
                  Date.parse(m.kickoff) < Date.parse(match.kickoff) &&
                  (m.homeId === id || m.awayId === id),
              ).length >= 5,
          )
        : data.has(match.id)))
  );
}
/** One chronological pass avoids scanning the full history for each sitemap URL. */
export function documentedResultIds(data: Dataset): Set<string> {
  const counts = new Map<string, number>();
  const ids = new Set<string>();
  const sorted = data.matches
    .filter(validResult)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id));
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (
      end < sorted.length &&
      Date.parse(sorted[end].kickoff) === Date.parse(sorted[start].kickoff)
    )
      end++;
    for (let i = start; i < end; i++) {
      const m = sorted[i];
      if ((counts.get(m.homeId) ?? 0) >= 5 && (counts.get(m.awayId) ?? 0) >= 5) ids.add(m.id);
    }
    for (let i = start; i < end; i++)
      for (const id of [sorted[i].homeId, sorted[i].awayId])
        counts.set(id, (counts.get(id) ?? 0) + 1);
    start = end;
  }
  return ids;
}
export function playerIndexable(appearances: number | null | undefined) {
  return Number.isSafeInteger(appearances) && (appearances ?? 0) >= 5;
}
export function indexablePaths(data: Dataset): string[] {
  if (data.source === 'demo' || (!data.matches.length && !data.teams.length))
    return [...editorialPaths];
  const counts = new Map<string, number>();
  const documented = documentedResultIds(data);
  const teamIds = new Set(data.teams.map((t) => t.id));
  for (const match of data.matches)
    for (const id of [match.homeId, match.awayId]) counts.set(id, (counts.get(id) ?? 0) + 1);
  const paths = Object.keys(publicPages).filter(
    (path) => path !== '/joueurs' || data.players.length > 0,
  );
  for (const [path, count] of [
    ['/equipes', data.teams.length],
    ['/joueurs', data.players.length],
    ['/competitions', data.competitions.length],
  ] as const) {
    if (!count) {
      const index = paths.indexOf(path);
      if (index >= 0) paths.splice(index, 1);
    }
    for (let page = 2; page <= Math.ceil(count / catalogueSize); page++)
      paths.push(`${path}?page=${page}`);
  }
  paths.push(
    ...data.teams.filter((t) => (counts.get(t.id) ?? 0) >= 5).map((t) => `/equipe/${t.slug}`),
    ...data.players
      .filter((p) => playerIndexable(p.stats.appearances) && teamIds.has(p.teamId))
      .map((p) => `/joueur/${p.slug}`),
    ...data.competitions
      .filter((c) => data.matches.some((m) => m.competitionId === c.id))
      .map((c) => `/competition/${c.slug}`),
    ...data.matches.filter((m) => matchIndexable(m, documented)).map((m) => `/match/${m.slug}`),
  );
  return [...new Set(paths)];
}

/** Optional tokens supplied by the owner, never a fabricated verification identity. */
export function searchVerification(
  env: Record<string, string | undefined> = process.env,
): Metadata['verification'] {
  const token = (value: string | undefined) => value?.trim() || undefined;
  const google = token(env.GOOGLE_SITE_VERIFICATION);
  const bing = token(env.BING_SITE_VERIFICATION);
  return { ...(google ? { google } : {}), ...(bing ? { other: { 'msvalidate.01': bing } } : {}) };
}

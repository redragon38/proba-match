import type { Metadata } from 'next';
import type { Dataset, Match } from '@/types/football';
import { isPreviewDeployment } from './deployment';

/** One origin for metadata, JSON-LD, robots and sitemap; never trust a request Host. */
export function siteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string {
  const url = new URL(
    value ||
      (process.env.VERCEL_ENV === 'production'
        ? 'https://probamatch.com'
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
    (process.env.VERCEL_ENV === 'production' && (local || url.hostname.endsWith('.vercel.app')))
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
        : { robots: { index, follow: true } }),
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
    'Scores, calendrier et statistiques de football',
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
    'Comprenez les sources OpenFootball et API-Football, le modèle Elo–Poisson, les probabilités et les limites des analyses Proba Match.',
  ],
};
export function publicMetadata(path: string, index?: boolean) {
  const [title, description] = publicPages[path];
  return seoMetadata(path, title, description, index);
}
export const catalogueSize = 24;
export function catalogueMetadata(path: string, count: number, page: number, real: boolean) {
  const [title, description] = publicPages[path];
  return seoMetadata(
    page === 1 ? path : `${path}?page=${page}`,
    page === 1 ? title : `${title} — page ${page}`,
    page === 1
      ? description
      : `${description} Page ${page} sur ${Math.ceil(count / catalogueSize)}.`,
    real && count > 0,
  );
}
export function matchIndexable(match: Match) {
  return (
    match.events.length > 0 ||
    match.lineups.length > 0 ||
    match.statistics.some((s) => s.home !== null || s.away !== null)
  );
}
export function indexablePaths(data: Dataset): string[] {
  if (data.source === 'demo') return [];
  const counts = new Map<string, number>();
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
    ...data.players.filter((p) => (p.stats.appearances ?? 0) >= 5).map((p) => `/joueur/${p.slug}`),
    ...data.competitions
      .filter((c) => data.matches.some((m) => m.competitionId === c.id))
      .map((c) => `/competition/${c.slug}`),
    ...data.matches.filter(matchIndexable).map((m) => `/match/${m.slug}`),
  );
  return [...new Set(paths)];
}

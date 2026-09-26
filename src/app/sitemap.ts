import type { MetadataRoute } from 'next';
import { getDataset } from '@/services/football';
import { absoluteUrl, indexablePaths } from '@/lib/seo';
import { isPreviewDeployment } from '@/lib/deployment';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!process.env.DATABASE_URL || isPreviewDeployment()) return [];
  const data = await getDataset();
  const dates = new Map(data.matches.map((m) => ['/match/' + m.slug, m.updatedAt]));
  return indexablePaths(data).map((path) => ({
    url: absoluteUrl(path),
    ...(dates.get(path) ? { lastModified: new Date(dates.get(path)!) } : {}),
  }));
}

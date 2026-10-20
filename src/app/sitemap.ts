import type { MetadataRoute } from 'next';
import { getDataset } from '@/services/football';
import { absoluteUrl, indexablePaths, editorialPaths } from '@/lib/seo';
import { editorialReviewDate } from '@/lib/editorial';
import { isPreviewDeployment } from '@/lib/deployment';
import { entityContentModifiedAt } from '@/lib/sitemap-lastmod';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isPreviewDeployment()) return [];
  if (!process.env.DATABASE_URL)
    return editorialPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: editorialReviewDate(path),
    }));
  const data = await getDataset();
  // Match updatedAt can be refreshed by a sync without any significant content change.
  // Omit that date until a dedicated content-change timestamp exists.
  return indexablePaths(data).map((path) => {
    const modified = editorialPaths.includes(path)
      ? editorialReviewDate(path)
      : entityContentModifiedAt(path, data);
    return { url: absoluteUrl(path), ...(modified ? { lastModified: modified } : {}) };
  });
}

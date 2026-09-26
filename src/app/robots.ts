import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { isPreviewDeployment } from '@/lib/deployment';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    // Keep previews crawlable so bots can actually read their noindex response.
    ...(!isPreviewDeployment() ? { sitemap: absoluteUrl('/sitemap.xml') } : {}),
  };
}

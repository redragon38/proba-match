import type { Metadata } from 'next';
import { Shell } from '@/components/shell';
import { getDataset } from '@/services/football';
import { DataUpdates } from '@/components/data-updates';
import { siteOrigin, absoluteUrl, searchVerification } from '@/lib/seo';
import { isPreviewDeployment } from '@/lib/deployment';
import { JsonLd } from '@/components/json-ld';
import { WebVitals } from '@/components/web-vitals';
import './globals.css';
import './dashboard.css';
import './features.css';
import './details.css';
import './accessibility.css';
import './sport.css';
import './product.css';
import './probabilities.css';
import './match-insights.css';
import './reading.css';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const data = await getDataset();
  return {
    metadataBase: new URL(siteOrigin()),
    verification: searchVerification(),
    title: {
      default: 'Proba Match — Le football, éclairé par les données',
      template: '%s | Proba Match',
    },
    description:
      'Matchs, statistiques, comparaisons et projections football. Une plateforme gratuite et transparente, en français.',
    openGraph: { locale: 'fr_FR', type: 'website', siteName: 'Proba Match' },
    twitter: { card: 'summary_large_image' },
    robots: {
      index: data.source !== 'demo' && data.matches.length > 0 && !isPreviewDeployment(),
      follow: !isPreviewDeployment(),
    },
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const data = await getDataset();
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body>
        {process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED === 'true' && <WebVitals />}
        <JsonLd
          value={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': absoluteUrl('/#website'),
                name: 'Proba Match',
                url: siteOrigin(),
                inLanguage: 'fr',
                publisher: { '@id': absoluteUrl('/#organization') },
              },
              {
                '@type': 'Organization',
                '@id': absoluteUrl('/#organization'),
                name: 'Proba Match',
                url: siteOrigin(),
                description: 'Plateforme de statistiques et de probabilités football.',
                logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.png') },
              },
            ],
          }}
        />
        <DataUpdates revision={data.revision} />
        <Shell
          liveCount={data.degraded ? 0 : data.matches.filter((m) => m.status === 'live').length}
          year={new Date().getFullYear()}
          leagues={data.competitions.map(({ flag, name, slug, logo }) => ({
            flag,
            name,
            slug,
            logo,
          }))}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}

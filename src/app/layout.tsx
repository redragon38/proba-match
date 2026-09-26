import type { Metadata } from 'next';
import { Shell } from '@/components/shell';
import { getDataset } from '@/services/football';
import { DataUpdates } from '@/components/data-updates';
import { siteOrigin } from '@/lib/seo';
import { isPreviewDeployment } from '@/lib/deployment';
import { JsonLd } from '@/components/json-ld';
import './globals.css';
import './dashboard.css';
import './features.css';
import './details.css';
import './accessibility.css';
import './sport.css';
import './product.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: 'Proba Match — Le football, éclairé par les données',
    template: '%s | Proba Match',
  },
  description:
    'Matchs, statistiques, comparaisons et projections football. Une plateforme gratuite et transparente, en français.',
  openGraph: { locale: 'fr_FR', type: 'website', siteName: 'Proba Match' },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: !!process.env.DATABASE_URL && !isPreviewDeployment(),
    follow: !isPreviewDeployment(),
  },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const data = await getDataset();
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body>
        <JsonLd
          value={{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Proba Match',
            url: siteOrigin(),
            inLanguage: 'fr',
          }}
        />
        <DataUpdates revision={data.revision} />
        <Shell
          liveCount={data.degraded ? 0 : data.matches.filter((m) => m.status === 'live').length}
          year={new Date().getFullYear()}
          leagues={data.competitions.map(({ flag, name, slug }) => ({ flag, name, slug }))}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import Script from 'next/script';
import { Shell } from '@/components/shell';
import { getShellData } from '@/services/football/shell';
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
  const data = await getShellData();

  return {
    metadataBase: new URL(siteOrigin()),
    verification: searchVerification(),
    title: {
      default: 'Proba Match — Le football, éclairé par les données',
      template: '%s | Proba Match',
    },
    description:
      'Matchs, statistiques, comparaisons et projections football. Une plateforme gratuite et transparente, en français.',
    openGraph: {
      locale: 'fr_FR',
      type: 'website',
      siteName: 'Proba Match',
    },
    twitter: {
      card: 'summary_large_image',
    },
    robots: {
      index: data.indexable && !isPreviewDeployment(),
      follow: !isPreviewDeployment(),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const data = await getShellData();

  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-B3WSHE5NLH"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-B3WSHE5NLH');
          `}
        </Script>

        {process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED === 'true' && (
          <WebVitals />
        )}

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
                publisher: {
                  '@id': absoluteUrl('/#organization'),
                },
              },
              {
                '@type': 'Organization',
                '@id': absoluteUrl('/#organization'),
                name: 'Proba Match',
                url: siteOrigin(),
                description:
                  'Plateforme de statistiques et de probabilités football.',
                logo: {
                  '@type': 'ImageObject',
                  url: absoluteUrl('/icon.png'),
                },
              },
            ],
          }}
        />

        <DataUpdates revision={data.revision} />

        <Shell
          liveCount={data.liveCount}
          year={new Date().getFullYear()}
          leagues={data.leagues}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}

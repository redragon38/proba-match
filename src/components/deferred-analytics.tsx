'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const analyticsId = 'G-B3WSHE5NLH';

export function DeferredAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const enable = () => setEnabled(true);
    const timer = window.setTimeout(enable, 60_000);
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll'];

    for (const event of events)
      window.addEventListener(event, enable, { passive: true, once: true });
    return () => {
      window.clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, enable);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`} />
      <Script id="google-analytics">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${analyticsId}', {
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}

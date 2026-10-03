'use client';
import { useReportWebVitals } from 'next/web-vitals';
const report: Parameters<typeof useReportWebVitals>[0] = ({ name, value }) => {
  if (!['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].includes(name)) return;
  // No URL, query, user ID, metric ID or referrer is transmitted.
  const body = JSON.stringify({ name, value });
  void fetch('/api/vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
};
export function WebVitals() {
  useReportWebVitals(report);
  return null;
}

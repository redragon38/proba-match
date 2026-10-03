import { z } from 'zod';
import { readJsonBody } from '@/lib/request-body';
import { allowVitalsReport } from '@/services/vitals-limit';
const input = z
  .object({
    name: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']),
    value: z.number().finite().min(0).max(3600000),
  })
  .strict();
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED !== 'true')
    return new Response(null, { status: 404, headers });
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new Response(null, { status: 403, headers });
  const body = await readJsonBody(request, 1024);
  if (!body.ok) return body.response;
  const parsed = input.safeParse(body.value);
  if (!parsed.success) return new Response(null, { status: 400, headers });
  try {
    if (!(await allowVitalsReport(request)))
      return new Response(null, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
    // Technical hosting logs; activation requires a real retention policy and log access.
    console.info(
      JSON.stringify({ event: 'WEB_VITAL', at: new Date().toISOString(), ...parsed.data }),
    );
    return new Response(null, { status: 204, headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}

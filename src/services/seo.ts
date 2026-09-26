import 'server-only';
import { notFound } from 'next/navigation';
import { catalogueSize } from '@/lib/seo';
export function cataloguePage(value: string | undefined, count: number) {
  const page = value == null ? 1 : Number(value);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > Math.max(1, Math.ceil(count / catalogueSize))
  )
    notFound();
  return page;
}

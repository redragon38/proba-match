import Link from 'next/link';
import { JsonLd } from './json-ld';
import { absoluteUrl } from '@/lib/seo';
export function Breadcrumbs({
  items,
  real = false,
}: {
  items: { name: string; href: string }[];
  real?: boolean;
}) {
  const all = [{ name: 'Accueil', href: '/' }, ...items];
  return (
    <>
      <nav className="breadcrumbs" aria-label="Fil d’Ariane">
        {all.map((item, i) => (
          <span key={item.href}>
            {i > 0 && <span aria-hidden="true"> / </span>}
            <Link href={item.href} aria-current={i === all.length - 1 ? 'page' : undefined}>
              {item.name}
            </Link>
          </span>
        ))}
      </nav>
      {real && (
        <JsonLd
          value={{
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: all.map((item, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: item.name,
              item: absoluteUrl(item.href),
            })),
          }}
        />
      )}
    </>
  );
}

import Link from 'next/link';
import { editorialReviewDate } from '@/lib/editorial';
export function EditorialContext({ path = '' }: { path?: string }) {
  const reviewed = editorialReviewDate(path);
  return (
    <p className="data-note editorial-context">
      Explications Proba Match, revues le{' '}
      <time dateTime={reviewed}>{reviewed.endsWith('06') ? '6' : '5'} octobre 2026</time>. Cette
      date concerne le texte, pas la fraîcheur des données sportives.{' '}
      <Link href="/sources-donnees">Origine et limites des données</Link>.
    </p>
  );
}
export function EditorialLinks() {
  return (
    <nav className="reading-links" aria-label="Guides et transparence">
      <Link href="/comprendre-probabilites">Comprendre les probabilités</Link>
      <Link href="/lexique-football">Lexique des statistiques</Link>
      <Link href="/methodologie">Méthode de calcul</Link>
      <Link href="/sources-donnees">Sources et couverture</Link>
    </nav>
  );
}

import { publicMetadata } from '@/lib/seo';
import { footballTerms, glossaryData } from '@/lib/editorial';
import { JsonLd } from '@/components/json-ld';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { EditorialContext, EditorialLinks } from '@/components/editorial-context';
export const metadata = publicMetadata('/lexique-football');
export default function Page() {
  return (
    <article className="page prose reading-guide">
      <Breadcrumbs items={[{ name: 'Lexique football', href: '/lexique-football' }]} real />
      <JsonLd value={glossaryData()} />
      <span className="eyebrow">LES MOTS DERRIÈRE LES CHIFFRES</span>
      <h1>Lexique des probabilités et statistiques football</h1>
      <p className="intro-text">
        {footballTerms.length} définitions pour comprendre un résultat, une estimation et ses
        limites. Chaque terme indique ce qu’il mesure et les précautions nécessaires pour le lire.
      </p>
      <EditorialContext />
      <nav className="reading-toc" aria-label="Termes du lexique">
        {footballTerms.map((t) => (
          <a key={t.id} href={`#${t.id}`}>
            {t.name}
          </a>
        ))}
      </nav>
      {footballTerms.map((t) => (
        <section key={t.id} id={t.id} className="reading-term">
          <h2>{t.name}</h2>
          <p>{t.definition}</p>
          <p className="data-note">
            <strong>À retenir :</strong> {t.caution}
          </p>
        </section>
      ))}
      <EditorialLinks />
    </article>
  );
}

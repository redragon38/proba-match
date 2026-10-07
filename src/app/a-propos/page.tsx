import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { editorialPageData } from '@/lib/editorial';
import { EditorialContext, EditorialLinks } from '@/components/editorial-context';
import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata('/a-propos');
import Link from 'next/link';
export default function Page() {
  return (
    <div className="page prose">
      <JsonLd value={editorialPageData('/a-propos', 'AboutPage')} />
      <Breadcrumbs items={[{ name: 'À propos', href: '/a-propos' }]} real />
      <span className="eyebrow">LE FOOTBALL, DÉCODÉ</span>
      <h1>Proba Match : comprendre le football par les données</h1>
      <EditorialContext />
      <p>
        Proba Match rassemble scores, statistiques et analyses pour comprendre les rencontres et
        suivre les équipes et les joueurs. L’accès est gratuit.
      </p>
      <h2>Des chiffres dont on connaît l’origine</h2>
      <p>
        Les données du fournisseur, les calculs Proba Match et les contenus fictifs de démonstration
        sont distingués. Une donnée absente reste indisponible.
      </p>
      <h2>Un modèle qui rend des comptes</h2>
      <p>
        Les probabilités sont des estimations statistiques, sans garantie de résultat. Les
        instantanés enregistrés avant un match restent conservés après son résultat.
      </p>
      <Link className="button" href="/methodologie">
        Comprendre la méthode
      </Link>
      <EditorialLinks />
    </div>
  );
}

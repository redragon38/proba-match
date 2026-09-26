import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata('/a-propos');
import Link from 'next/link';
export default function Page() {
  return (
    <div className="page prose">
      <span className="eyebrow">LE FOOTBALL, DÉCODÉ</span>
      <h1>Le jeu mérite du contexte.</h1>
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
    </div>
  );
}

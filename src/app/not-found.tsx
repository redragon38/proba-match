import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="page empty">
      <span className="eyebrow">HORS-JEU · 404</span>
      <h1>Cette page est introuvable.</h1>
      <p>La rencontre ou le profil demandé n’est pas dans notre catalogue.</p>
      <Link className="button" href="/matchs">
        Retrouver les matchs
      </Link>
      <form action="/recherche" className="catalog-search">
        <label htmlFor="missing-search">Rechercher dans Proba Match</label>
        <input id="missing-search" name="q" type="search" placeholder="Équipe, joueur…" />
        <button className="button secondary" type="submit">
          Rechercher
        </button>
      </form>
      <div className="suggestions">
        <Link href="/">Accueil</Link>
        <Link href="/competitions">Compétitions</Link>
      </div>
    </div>
  );
}

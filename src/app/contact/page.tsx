import { legalConfig } from '@/lib/legal';
import { seoMetadata } from '@/lib/seo';
export const metadata = seoMetadata(
  '/contact',
  'Contact',
  'Contactez l’éditeur de Proba Match lorsque ses coordonnées sont disponibles et découvrez comment signaler une erreur dans les données football.',
  false,
);
export default function Page() {
  const email = legalConfig().contact;
  return (
    <div className="page prose">
      <span className="eyebrow">NOUS CONTACTER</span>
      <h1>Une question sur Proba Match ?</h1>
      {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
        <p>
          <a className="button" href={`mailto:${email}`}>
            Contacter l’éditeur
          </a>
        </p>
      ) : (
        <>
          <p>
            Le canal de contact de l’éditeur n’est pas encore configuré. Aucun formulaire ne
            collecte vos informations pour le moment.
          </p>
        </>
      )}
      <h2>Signaler une donnée incorrecte</h2>
      <p>
        Conservez l’adresse de la rencontre ou du profil, l’heure de consultation et le nom de la
        source affichée. Ces éléments permettront à l’éditeur de vérifier le signalement lorsque son
        adresse de contact sera publiée.
      </p>
    </div>
  );
}

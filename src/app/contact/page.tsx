import { legalConfig } from '@/lib/legal';
import { seoMetadata } from '@/lib/seo';
export const metadata = seoMetadata(
  '/contact',
  'Contact — Proba Match',
  'Écrivez à Proba Match pour poser une question, signaler une donnée incorrecte ou proposer une amélioration.',
  false,
);
export default function Page() {
  const email = legalConfig().contact;
  return (
    <div className="page prose">
      <span className="eyebrow">NOUS CONTACTER</span>
      <h1>Une question sur Proba Match ?</h1>
      {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
        <>
          <p>
            Une question, une correction ou une suggestion ? Écrivez-nous directement à{' '}
            <a href={`mailto:${email}`}>{email}</a>.
          </p>
          <p>
            <a
              className="button"
              href={`mailto:${email}?subject=${encodeURIComponent('Contact depuis Proba Match')}`}
            >
              Envoyer un e-mail
            </a>
          </p>
        </>
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
        source affichée. Ces éléments nous permettront de vérifier rapidement le signalement.
      </p>
    </div>
  );
}

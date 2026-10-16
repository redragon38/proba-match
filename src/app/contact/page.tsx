import {
  ArrowUpRight,
  Database,
  Handshake,
  Lightbulb,
  Mail,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { legalConfig } from '@/lib/legal';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata(
  '/contact',
  'Contact — Proba Match',
  'Écrivez à Proba Match pour poser une question, signaler une donnée incorrecte ou proposer une amélioration.',
  false,
);

function emailHref(email: string, subject: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export default function Page() {
  const email = legalConfig().contact;
  if (!email) return null;

  const reasons = [
    {
      icon: Database,
      title: 'Signaler une donnée',
      description: 'Score, horaire, joueur, composition ou statistique à vérifier.',
      subject: 'Signalement d’une donnée sur Proba Match',
    },
    {
      icon: Lightbulb,
      title: 'Proposer une amélioration',
      description: 'Une idée pour rendre le site, les analyses ou les pages plus utiles.',
      subject: 'Suggestion pour Proba Match',
    },
    {
      icon: MessageCircle,
      title: 'Poser une question',
      description: 'Une question générale sur le fonctionnement ou les données du site.',
      subject: 'Question à propos de Proba Match',
    },
    {
      icon: Handshake,
      title: 'Proposer une collaboration',
      description: 'Partenariat, média, données, contenu ou projet commun avec Proba Match.',
      subject: 'Proposition de collaboration avec Proba Match',
    },
  ];

  return (
    <div className="page contact-page">
      <Breadcrumbs items={[{ name: 'Contact', href: '/contact' }]} />

      <header className="contact-hero card">
        <div className="contact-hero-icon" aria-hidden="true">
          <Mail size={30} />
        </div>
        <div className="contact-hero-copy">
          <span className="eyebrow">NOUS CONTACTER</span>
          <h1>Parlons de Proba Match</h1>
          <p>
            Une question, une correction ou une suggestion ? Écrivez-nous directement. Votre message
            arrivera dans la boîte de réception officielle de Proba Match.
          </p>
          <div className="contact-primary-actions">
            <a className="button" href={emailHref(email, 'Contact depuis Proba Match')}>
              <Mail size={17} />
              Envoyer un e-mail
            </a>
            <a className="contact-address" href={`mailto:${email}`}>
              {email}
            </a>
          </div>
        </div>
      </header>

      <section className="contact-section" aria-labelledby="contact-reason-title">
        <div className="contact-section-heading">
          <span className="eyebrow">VOTRE DEMANDE</span>
          <h2 id="contact-reason-title">Comment pouvons-nous vous aider ?</h2>
        </div>
        <div className="contact-reason-grid">
          {reasons.map((reason) => (
            <a
              className="contact-reason card"
              href={emailHref(email, reason.subject)}
              key={reason.title}
            >
              <reason.icon size={22} aria-hidden="true" />
              <h3>{reason.title}</h3>
              <p>{reason.description}</p>
              <span>
                Écrire <ArrowUpRight size={15} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="contact-info-grid" aria-label="Informations pratiques">
        <article className="contact-info-card card">
          <Database size={23} aria-hidden="true" />
          <div>
            <h2>Pour signaler une erreur</h2>
            <p>Indiquez si possible :</p>
            <ul>
              <li>l’adresse de la page concernée ;</li>
              <li>le match, l’équipe ou le joueur ;</li>
              <li>la donnée qui semble incorrecte ;</li>
              <li>l’heure à laquelle vous l’avez constatée.</li>
            </ul>
          </div>
        </article>
        <article className="contact-info-card card">
          <ShieldCheck size={23} aria-hidden="true" />
          <div>
            <h2>Un contact simple et direct</h2>
            <p>
              Le bouton ouvre votre application de messagerie. Aucun formulaire, message ou donnée
              personnelle n’est enregistré par cette page.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}

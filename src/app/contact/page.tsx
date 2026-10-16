import { Database, Mail, ShieldCheck } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ContactForm } from '@/components/contact-form';
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
            Une question, une correction ou une proposition de collaboration ? Remplissez le
            formulaire ci-dessous pour préparer votre message.
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

      <ContactForm recipient={email} />

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
              Le formulaire prépare le message dans votre application de messagerie. Aucun message
              ni aucune donnée personnelle n’est enregistré par cette page.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}

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
            Une question, une correction ou une proposition de collaboration ? Envoyez-nous votre
            message directement depuis cette page.
          </p>
          <div className="contact-primary-actions">
            <span className="contact-address">{email}</span>
          </div>
        </div>
      </header>

      <ContactForm />

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
              Votre message est transmis depuis le site à notre adresse de contact. Il n’est pas
              publié sur Proba Match.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}

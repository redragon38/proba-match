'use client';

import { FormEvent, useState } from 'react';
import { Mail, Send } from 'lucide-react';

type ContactFormProps = {
  recipient: string;
};

const reasons = [
  'Question générale',
  'Signaler une donnée incorrecte',
  'Proposer une amélioration',
  'Proposition de collaboration',
  'Autre demande',
];

export function ContactForm({ recipient }: ContactFormProps) {
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const replyTo = String(data.get('email') ?? '').trim();
    const reason = String(data.get('reason') ?? '').trim();
    const subject = String(data.get('subject') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    const body = [
      `Nom : ${name}`,
      `Adresse de réponse : ${replyTo}`,
      `Motif : ${reason}`,
      '',
      message,
    ].join('\n');

    setSubmitted(true);
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(`[${reason}] ${subject}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="contact-form card" onSubmit={submit}>
      <div className="contact-form-heading">
        <span className="contact-form-icon" aria-hidden="true">
          <Mail size={22} />
        </span>
        <div>
          <h2>Envoyer un message</h2>
          <p>Tous les champs sont obligatoires.</p>
        </div>
      </div>

      <div className="contact-form-grid">
        <label>
          <span>Nom</span>
          <input name="name" type="text" autoComplete="name" maxLength={80} required />
        </label>
        <label>
          <span>Adresse e-mail</span>
          <input name="email" type="email" autoComplete="email" maxLength={160} required />
        </label>
        <label>
          <span>Motif</span>
          <select name="reason" defaultValue="" required>
            <option value="" disabled>
              Sélectionnez un motif
            </option>
            {reasons.map((reason) => (
              <option value={reason} key={reason}>
                {reason}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sujet</span>
          <input name="subject" type="text" maxLength={120} required />
        </label>
        <label className="contact-form-message">
          <span>Message</span>
          <textarea name="message" rows={7} minLength={10} maxLength={3000} required />
        </label>
      </div>

      <div className="contact-form-footer">
        <p>
          Le bouton ouvrira votre application de messagerie. Vérifiez puis envoyez le message depuis
          celle-ci.
        </p>
        <button className="button" type="submit">
          <Send size={17} aria-hidden="true" />
          Préparer l’e-mail
        </button>
      </div>
      {submitted ? (
        <p className="contact-form-status" role="status">
          Vérifiez votre messagerie et cliquez sur Envoyer pour terminer. Si elle ne s’ouvre pas,
          utilisez l’adresse indiquée en haut de la page.
        </p>
      ) : null}
    </form>
  );
}

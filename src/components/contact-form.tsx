'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Mail, Send } from 'lucide-react';

const reasons = [
  'Question générale',
  'Signaler une donnée incorrecte',
  'Proposer une amélioration',
  'Proposition de collaboration',
  'Autre demande',
];

export function ContactForm() {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSending(true);
    setStatus('idle');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'L’envoi a échoué.');
      form.reset();
      setStatus('sent');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'L’envoi a échoué. Réessayez plus tard.');
      setStatus('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="contact-form card" onSubmit={submit}>
      <div className="contact-form-heading">
        <span className="contact-form-icon" aria-hidden="true"><Mail size={22} /></span>
        <div>
          <span className="eyebrow">VOTRE MESSAGE</span>
          <h2>Écrivez-nous</h2>
          <p>Une question ou un projet ? Nous vous lisons avec attention.</p>
        </div>
      </div>

      <div className="contact-form-grid">
        <label><span>Votre nom</span><input name="name" type="text" autoComplete="name" placeholder="Votre nom" minLength={2} maxLength={80} required /></label>
        <label><span>Votre adresse e-mail</span><input name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" maxLength={160} required /></label>
        <label><span>Motif de votre message</span><select name="reason" defaultValue="" required><option value="" disabled>Choisir un motif</option>{reasons.map((reason) => <option value={reason} key={reason}>{reason}</option>)}</select></label>
        <label><span>Sujet</span><input name="subject" type="text" placeholder="En quelques mots" minLength={3} maxLength={120} required /></label>
        <label className="contact-form-message"><span>Votre message</span><textarea name="message" rows={7} placeholder="Expliquez-nous votre demande…" minLength={10} maxLength={3000} required /></label>
      </div>
      <div className="contact-honeypot" aria-hidden="true"><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <div className="contact-form-footer">
        <p>Votre message est envoyé directement à Proba Match. Les champs sont obligatoires.</p>
        <button className="button" type="submit" disabled={sending}>
          <Send size={17} aria-hidden="true" />{sending ? 'Envoi en cours…' : 'Envoyer le message'}
        </button>
      </div>
      {status === 'sent' && <p className="contact-form-status" role="status"><CheckCircle2 size={18} /> Message envoyé. Merci de nous avoir écrit !</p>}
      {status === 'error' && <p className="contact-form-status contact-form-error" role="alert">{error}</p>}
    </form>
  );
}

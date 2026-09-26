'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AdminLogin() {
  const [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="card admin-login"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch('/api/admin/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret }),
          });
          if (r.ok) {
            setSecret('');
            router.refresh();
          } else
            setError(
              r.status === 429
                ? 'Trop de tentatives. Réessayez dans dix minutes.'
                : 'Accès refusé. Vérifiez la configuration et votre clé administrateur.',
            );
        } catch {
          setError('Connexion indisponible.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="admin-secret">Clé administrateur</label>
      <input
        id="admin-secret"
        type="password"
        value={secret}
        autoComplete="current-password"
        onChange={(e) => setSecret(e.target.value)}
        required
      />
      <button className="button" disabled={busy}>
        {busy ? 'Vérification…' : 'Se connecter'}
      </button>
      <p role="status">{error}</p>
    </form>
  );
}
export function AdminControls() {
  const [date, setDate] = useState(''),
    [enrich, setEnrich] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter();
  return (
    <div className="card padded">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage('Synchronisation en cours…');
          try {
            const r = await fetch('/api/admin/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: date || undefined, enrich }),
            });
            const body = await r.json();
            setMessage(
              r.ok
                ? `État : ${body.status} · ${body.matches} matchs · ${body.requests} requêtes.`
                : body.error,
            );
            router.refresh();
          } catch {
            setMessage('Connexion interrompue.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="filter-panel">
          <label>
            Date de l’enrichissement secondaire (facultative)
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} />{' '}
            Actualiser les joueurs et absences manquants ou périmés (quota supplémentaire)
          </label>
        </div>
        <button className="button" disabled={busy}>
          Enrichir les données locales
        </button>
        <p className="data-note" role="status">
          {message}
        </p>
      </form>
      <button
        className="text-link"
        onClick={async () => {
          await fetch('/api/admin/session', { method: 'DELETE' });
          router.refresh();
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
}

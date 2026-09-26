'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function DataControls({
  issues,
  teams,
}: {
  issues: { id: string; kind: string; externalName: string; externalId: string }[];
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(path: string, body: unknown) {
    setBusy(true);
    setMessage('Opération en cours…');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? `État : ${result.status}${result.matches != null ? ` · ${result.matches} matchs · ${result.failures ?? 0} fichiers en échec` : ''}`
          : result.error,
      );
      router.refresh();
    } catch {
      setMessage('Connexion interrompue. Consultez le journal avant de relancer.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card padded">
      <h2>Import OpenFootball</h2>
      <p>Sans clé API. Le premier import couvre quatre saisons des ligues configurées.</p>
      <button
        className="button"
        disabled={busy}
        onClick={() => submit('/api/admin/sync', { provider: 'openfootball', history: true })}
      >
        Importer l’historique
      </button>{' '}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => submit('/api/admin/sync', { provider: 'openfootball' })}
      >
        Actualiser la saison
      </button>
      <p role="status">{message}</p>
      <h3>Correspondances à confirmer</h3>
      {!issues.length && <p>Aucune correspondance en attente.</p>}
      {issues.map((issue) => (
        <form
          key={issue.id}
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void submit('/api/admin/mapping', {
              issueId: issue.id,
              entityId: form.get('entityId'),
            });
          }}
        >
          <label>
            {issue.externalName} · {issue.kind} · {issue.externalId}
            {issue.kind === 'team' ? (
              <select name="entityId" required defaultValue="">
                <option value="" disabled>
                  Choisir l’équipe Proba Match
                </option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <input name="entityId" required placeholder="Identifiant interne vérifié" />
            )}
          </label>
          <button className="button secondary" disabled={busy}>
            Confirmer la correspondance
          </button>
        </form>
      ))}
    </section>
  );
}

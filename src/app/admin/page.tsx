import Link from 'next/link';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { db } from '@/database/client';
import { AdminLogin, AdminControls } from '@/features/admin/admin-panel';
import { Metric, SectionTitle } from '@/components/ui';
import { MODEL_VERSION } from '@/prediction-engine';
import { DataControls } from '@/features/admin/data-controls';
import { secondaryBudget } from '@/services/football/quota';
import { workerHealth } from '@/services/football/worker-health';
import { openScopes } from '@/services/football/openfootball-sync';
import { openSyncLate } from '@/services/football/worker-loop';
export const metadata = { title: 'Administration', robots: { index: false, follow: false } };
export default async function Page() {
  const allowed = verifyAdminSession((await cookies()).get('ms-admin')?.value);
  if (!allowed)
    return (
      <div className="page">
        <span className="eyebrow">ACCÈS PROTÉGÉ</span>
        <h1>Administration</h1>
        <AdminLogin />
      </div>
    );
  let state: {
    matches: number;
    cache: number;
    requests: number;
    competitions: number;
    teams: number;
    players: number;
    latestPrediction: Date | null;
    runs: {
      id: string;
      startedAt: Date;
      status: string;
      requests: number;
      matches: number;
      errorCode: string | null;
    }[];
  } | null = null;
  try {
    if (process.env.DATABASE_URL) {
      const [matches, cache, quota, competitions, runs, teams, players, latestPrediction] =
        await Promise.all([
          db.match.count(),
          db.cacheEntry.count(),
          db.apiQuota.findUnique({ where: { day: new Date().toISOString().slice(0, 10) } }),
          db.competition.count(),
          db.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
          db.team.count(),
          db.player.count(),
          db.prediction.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        ]);
      state = {
        matches,
        cache,
        requests: quota?.count ?? 0,
        competitions,
        runs,
        teams,
        players,
        latestPrediction: latestPrediction?.createdAt ?? null,
      };
    }
  } catch {
    /* Show the actual missing state. */
  }
  const extra = process.env.DATABASE_URL
    ? await Promise.all([
        db.dataSource.findMany({ orderBy: { id: 'asc' } }),
        db.mappingIssue.findMany({ where: { resolvedAt: null }, take: 100 }),
        db.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        db.season.count(),
        db.syncRun.findFirst({
          where: { provider: 'api-football', requests: { gt: 0 } },
          orderBy: { startedAt: 'desc' },
        }),
        db.cacheEntry.findUnique({ where: { key: 'football:worker' }, select: { payload: true } }),
      ]).catch(() => null)
    : null;
  const worker = workerHealth(extra?.[5]?.payload);
  const scopeIds = new Set(
    openScopes().map((scope) => `openfootball:${scope.league}:${scope.season}`),
  );
  const sources = extra?.[0].filter((source) => scopeIds.has(source.id)) ?? [];
  const syncLate = openSyncLate(
    sources,
    scopeIds.size,
    process.env.VERCEL ? 20 * 3600000 : 5 * 60000,
  );
  return (
    <div className="page">
      <span className="eyebrow">OBSERVABILITÉ</span>
      <h1>Les coulisses de Proba Match.</h1>
      <Link href="/admin/performance-modele">Performance du modèle</Link>
      <p className="data-note">
        Fournisseur : OpenFootball +{' '}
        {process.env.FOOTBALL_API_KEY ? 'API-Football configuré' : 'aucune API secondaire'} ·
        Version : {MODEL_VERSION}
      </p>
      <div className="metrics">
        <Metric label="Matchs synchronisés" value={state?.matches ?? 'Non disponible'} />
        <Metric label="Requêtes aujourd’hui (UTC)" value={state?.requests ?? 'Non disponible'} />
        <Metric label="Entrées de cache" value={state?.cache ?? 'Non disponible'} />
        <Metric label="Compétitions" value={state?.competitions ?? 'Non disponible'} />
      </div>
      <AdminControls />
      <SectionTitle title="Synchronisation automatique" />
      <p className="data-note">
        Lecture de la base toutes les 30 secondes. OpenFootball :{' '}
        {process.env.VERCEL
          ? 'contrôle quotidien par cron'
          : 'contrôle serveur toutes les 6 heures'}
        .
      </p>
      {(syncLate || worker.status === 'DEGRADED') && (
        <p className="warning" role="status">
          Synchronisation en retard. Consultez les dernières tentatives et les sources ci-dessous.
        </p>
      )}
      <div className="metrics three">
        <Metric
          label="Worker"
          value={
            worker.state === 'active'
              ? 'Actif'
              : worker.state === 'late'
                ? 'En retard'
                : 'Non détecté'
          }
          note={
            worker.state === 'active'
              ? 'Signal de vie reçu depuis moins de 2 minutes'
              : 'Vérifier le planificateur et les journaux du serveur'
          }
        />
        <Metric
          label="Dernier contrôle"
          value={worker.checkedAt ? new Date(worker.checkedAt).toLocaleString('fr-FR') : 'Aucun'}
          note="Cette page se met à jour toutes les 30 secondes"
        />
        <Metric
          label="Prochain contrôle OpenFootball"
          value={
            worker.nextOpen ? new Date(worker.nextOpen).toLocaleString('fr-FR') : 'Non disponible'
          }
          note={
            process.env.FOOTBALL_API_KEY
              ? `Secondaire : ${worker.secondaryStatus ?? 'non détecté'}`
              : 'Live externe désactivé : clé non configurée'
          }
        />
      </div>
      <div className="metrics three">
        <Metric label="Saisons en base" value={extra?.[3] ?? 'Non disponible'} />
        <Metric
          label="Quota secondaire restant"
          value={state ? Math.max(0, secondaryBudget() - state.requests) : 'Non disponible'}
          note={`Limite : ${secondaryBudget()} / jour UTC`}
        />
        <Metric
          label="Dernier appel secondaire (job)"
          value={extra?.[4]?.startedAt.toLocaleString('fr-FR') ?? 'Aucun'}
        />
      </div>
      <DataControls issues={extra?.[1] ?? []} teams={extra?.[2] ?? []} />
      <SectionTitle title="Sources OpenFootball importées" />
      <ul>
        {extra?.[0].map((source) => (
          <li key={source.id}>
            {source.id} · {source.lastSyncedAt?.toLocaleString('fr-FR') ?? 'Jamais synchronisé'} ·{' '}
            {source.license}
          </li>
        ))}
      </ul>
      <p className="data-note">
        Cache partagé PostgreSQL + cache mémoire de lecture. Le taux de succès du cache n’est pas
        instrumenté.
      </p>
      <div className="metrics three">
        <Metric label="Équipes" value={state?.teams ?? 'Non disponible'} />
        <Metric label="Joueurs" value={state?.players ?? 'Non disponible'} />
        <Metric
          label="Dernière prédiction enregistrée"
          value={state?.latestPrediction?.toLocaleString('fr-FR') ?? 'Non disponible'}
        />
      </div>
      <SectionTitle title="Dernières synchronisations" />
      {state ? (
        <div
          className="card data-table"
          tabIndex={0}
          role="region"
          aria-label="Tableau de statistiques"
        >
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>État</th>
                <th>Requêtes</th>
                <th>Matchs</th>
                <th>Code d’erreur</th>
              </tr>
            </thead>
            <tbody>
              {state.runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.startedAt.toLocaleString('fr-FR')}</td>
                  <td>{r.status}</td>
                  <td>{r.requests}</td>
                  <td>{r.matches}</td>
                  <td>{r.errorCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="warning">Base de données non configurée ou indisponible.</p>
      )}
    </div>
  );
}

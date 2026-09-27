import Link from 'next/link';
import { ProviderImage } from '@/components/provider-image';
import { notFound } from 'next/navigation';
import { getDataset } from '@/services/football';
import { FavoriteButton } from '@/features/favorites';
import { SourceBanner } from '@/components/source-banner';
import { Metric, SectionTitle, TeamBadge } from '@/components/ui';
import { number } from '@/lib/format';
import { playerPerformance } from '@/prediction-engine/player';
import { playerHistory } from '@/services/profile-history';
import { JsonLd } from '@/components/json-ld';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { TrendChart } from '@/components/charts';
import { seoMetadata } from '@/lib/seo';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getDataset();
  const p = d.players.find((p) => p.slug === slug);
  if (!p) notFound();
  return seoMetadata(
    `/joueur/${slug}`,
    p.source === 'thesportsdb' ? `${p.name} — profil joueur` : `${p.name} — profil et statistiques`,
    p.source === 'thesportsdb'
      ? `Profil communautaire de ${p.name} : club et poste indiqués par TheSportsDB. Effectif partiel, sans statistiques individuelles vérifiées.`
      : `Profil de ${p.name} : poste, équipe, temps de jeu et performances disponibles. Explorez son historique et ses statistiques sur Proba Match.`,
    d.source !== 'demo' && (p.stats.appearances ?? 0) >= 5,
  );
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getDataset();
  const p = data.players.find((p) => p.slug === slug);
  if (!p) notFound();
  const history = await playerHistory(p.id);
  const t = data.teams.find((t) => t.id === p.teamId)!;
  const score = playerPerformance(p.stats, p.position);
  const mainMetric =
    p.position === 'Gardien'
      ? (['Arrêts', p.stats.saves] as const)
      : p.position === 'Défenseur'
        ? (['Tacles', p.stats.tackles] as const)
        : p.position === 'Milieu'
          ? (['Passes clés', p.stats.keyPasses] as const)
          : (['Buts', p.stats.goals] as const);
  const secondaryMetric =
    p.position === 'Gardien'
      ? (['Buts encaissés', p.stats.conceded] as const)
      : p.position === 'Défenseur'
        ? (['Interceptions', p.stats.interceptions] as const)
        : (['Passes décisives', p.stats.assists] as const);
  const avatar = (
    <span className="profile-avatar" aria-hidden="true">
      {p.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
  const recent = data.matches
    .flatMap((m) =>
      (m.performances ?? [])
        .filter((r) => r.playerId === p.id)
        .map((r) => ({ match: m, stats: r.stats })),
    )
    .sort((a, b) => a.match.kickoff.localeCompare(b.match.kickoff))
    .slice(-10);
  const age = p.birthDate
    ? Math.floor(
        (new Date(data.updatedAt).getTime() - new Date(p.birthDate).getTime()) /
          (365.2425 * 86400_000),
      )
    : null;
  const rows: [string, number | null | undefined][] = [
    ['Matchs', p.stats.appearances],
    ['Titularisations', p.stats.starts],
    ['Minutes', p.stats.minutes],
    ['Buts', p.stats.goals],
    ['Passes décisives', p.stats.assists],
    ['Tirs', p.stats.shots],
    ['Tirs cadrés', p.stats.shotsOnTarget],
    ['xG', p.stats.xg],
    ['xA', p.stats.xa],
    ['Passes', p.stats.passes],
    ['Passes clés', p.stats.keyPasses],
    ['Dribbles', p.stats.dribbles],
    ['Duels', p.stats.duels],
    ['Tacles', p.stats.tackles],
    ['Interceptions', p.stats.interceptions],
    ['Cartons jaunes', p.stats.yellow],
    ['Cartons rouges', p.stats.red],
  ];
  if (p.position === 'Gardien')
    rows.unshift(['Arrêts', p.stats.saves], ['Buts encaissés', p.stats.conceded]);
  return (
    <div className="page">
      {data.source !== 'demo' && p.source !== 'thesportsdb' && (
        <JsonLd
          value={{
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: p.name,
            birthDate: p.birthDate,
            nationality: p.nationality,
            image: p.photo,
            memberOf: { '@type': 'SportsTeam', name: t.name },
          }}
        />
      )}
      <SourceBanner data={data} />
      {p.source === 'thesportsdb' && (
        <p className="data-note">
          Profil issu du catalogue communautaire TheSportsDB, synchronisé le{' '}
          {new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'short',
            timeZone: 'Europe/Paris',
          }).format(new Date(p.updatedAt ?? data.updatedAt))}
          . L’effectif affiché est partiel et les statistiques individuelles ne sont pas fournies
          par cette source.
        </p>
      )}
      <Breadcrumbs
        items={[
          { name: 'Joueurs', href: '/joueurs' },
          { name: p.name, href: `/joueur/${p.slug}` },
        ]}
        real={data.source !== 'demo'}
      />
      <div className="card profile-header">
        {p.photo ? (
          <ProviderImage key={p.photo} src={p.photo} alt={p.name} size={90} fallback={avatar} />
        ) : (
          <span className="profile-avatar">
            {p.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </span>
        )}
        <div>
          <span className="eyebrow">
            {p.position} · N° {p.number ?? '–'}
          </span>
          <h1>{p.name}</h1>
          <p>
            {age ? `${age} ans` : 'Âge non disponible'} ·{' '}
            {p.nationality ?? 'Nationalité non disponible'}
          </p>
          <Link className="table-team" href={`/equipe/${t.slug}`}>
            <TeamBadge team={t} size={23} />
            {t.name}
          </Link>
        </div>
        <FavoriteButton id={`player:${p.id}`} label={p.name} />
      </div>
      <div className="metrics">
        <Metric label="Minutes jouées" value={number(p.stats.minutes)} />
        <Metric label={mainMetric[0]} value={number(mainMetric[1])} />
        <Metric label={secondaryMetric[0]} value={number(secondaryMetric[1])} />
        <Metric
          label="Indice de performance calculé"
          value={score === null ? 'Données insuffisantes' : `${score}/100`}
          note="Heuristique adaptée au poste"
        />
      </div>
      <div className="detail-columns">
        <div>
          <SectionTitle title="La forme match après match" />
          <section className="card padded">
            {recent.some((r) => r.stats.rating !== null) ? (
              <TrendChart
                label="Notes du fournisseur · rencontres disponibles"
                values={recent
                  .filter((r) => r.stats.rating !== null)
                  .map((r) => ({ label: r.match.kickoff.slice(5, 10), value: r.stats.rating! }))}
              />
            ) : (
              <p className="data-note">Aucune série de notes individuelles disponible.</p>
            )}
            {recent.map((r) => (
              <Link
                className="squad-row"
                href={`/match/${r.match.slug}?onglet=joueurs`}
                key={r.match.id}
              >
                <span>{r.match.kickoff.slice(0, 10)}</span>
                <span>{r.stats.minutes ?? '–'} min</span>
                <strong>{number(r.stats.rating, 1)}</strong>
              </Link>
            ))}
          </section>
          <SectionTitle title="Statistiques disponibles" />
          <div
            className="card data-table"
            tabIndex={0}
            role="region"
            aria-label="Tableau de statistiques"
          >
            <table>
              <thead>
                <tr>
                  <th>Indicateur</th>
                  <th>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, v]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    <td>{number(v, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SectionTitle title="Historique saison par saison" />
          {history.length > 0 && (
            <div
              className="card data-table"
              tabIndex={0}
              role="region"
              aria-label="Historique saisonnier"
            >
              <table>
                <thead>
                  <tr>
                    <th>Saison</th>
                    <th>Compétition</th>
                    <th>Matchs</th>
                    <th>Minutes</th>
                    <th>Buts</th>
                    <th>Passes D.</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={`${h.competition}-${h.season}`}>
                      <th>
                        {h.season}/{h.season + 1}
                      </th>
                      <td>{h.competition}</td>
                      <td>{number(h.stats.appearances)}</td>
                      <td>{number(h.stats.minutes)}</td>
                      <td>{number(h.stats.goals)}</td>
                      <td>{number(h.stats.assists)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="card padded data-note">
            {history.length
              ? 'Dernier relevé disponible pour chaque saison et compétition synchronisée.'
              : 'Historique non disponible. Les statistiques affichées décrivent uniquement le dernier relevé du fournisseur ou le scénario de démonstration.'}
          </p>
        </div>
        <aside>
          <SectionTitle title="Profil" />
          <section className="card padded">
            <div className="factor">
              <strong>Taille</strong>
              <p>{p.height ?? 'Non disponible'}</p>
            </div>
            <div className="factor">
              <strong>Pied préféré</strong>
              <p>{p.foot ?? 'Non disponible'}</p>
            </div>
            <div className="factor">
              <strong>Note moyenne de la source</strong>
              <p>{number(p.stats.rating, 2)}</p>
            </div>
            <p className="data-note">
              L’indice de performance est un calcul Proba Match, distinct de la note du fournisseur.
              Il décrit les observations disponibles ; il ne prédit pas une performance future.
            </p>
            <Link href={`/comparateur/joueurs?a=${p.id}`} className="button full-width">
              Comparer ce joueur
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

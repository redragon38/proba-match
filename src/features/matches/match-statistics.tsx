import type { Match, MatchStat, Team } from '@/types/football';
import { number } from '@/lib/format';

const groups: { title: string; labels: string[] }[] = [
  {
    title: 'Essentiel',
    labels: [
      'Possession',
      'Tirs',
      'Tirs cadrés',
      'Corners',
      'xG',
      'Fautes',
      'Cartons jaunes',
      'Cartons rouges',
    ],
  },
  {
    title: 'Attaque',
    labels: [
      'Grosses occasions',
      'Grosses occasions manquées',
      'Tirs non cadrés',
      'Tirs bloqués',
      'Tirs dans la surface',
      'Tirs hors surface',
      'Hors-jeu',
      'Centres',
      'Attaques',
      'Attaques dangereuses',
    ],
  },
  {
    title: 'Passes',
    labels: [
      'Passes',
      'Passes réussies',
      'Précision des passes',
      'Passes clés',
      'Passes longues',
      'Passes dans le dernier tiers',
    ],
  },
  {
    title: 'Défense',
    labels: ['Tacles', 'Interceptions', 'Dégagements', 'Duels', 'Duels gagnés', 'Arrêts'],
  },
  { title: 'Discipline', labels: ['Fautes', 'Cartons jaunes', 'Cartons rouges'] },
  { title: 'Autres données fournies', labels: [] },
];
const explanations: Record<string, string> = {
  xG: 'Estimation de la qualité des occasions créées.',
  xGOT: 'Qualité estimée des tirs cadrés selon leur placement.',
  'Tirs cadrés': 'Tirs qui auraient fini dans le but sans intervention du gardien.',
  'Précision des passes': 'Pourcentage de passes réussies.',
  PPDA: 'Indicateur de l’intensité du pressing.',
  'Field tilt': 'Part de possession territoriale dans le dernier tiers.',
};

export function validMatchStats(stats: MatchStat[]) {
  return stats.filter(
    (stat) =>
      (stat.home != null && Number.isFinite(stat.home) && stat.home >= 0) ||
      (stat.away != null && Number.isFinite(stat.away) && stat.away >= 0),
  );
}

export function statReading(stat: MatchStat, home: Team, away: Team) {
  if (
    stat.home == null ||
    stat.away == null ||
    !Number.isFinite(stat.home) ||
    !Number.isFinite(stat.away) ||
    stat.home < 0 ||
    stat.away < 0
  )
    return null;
  const gap = Math.abs(stat.home - stat.away);
  const balanced = stat.label === 'Possession' ? 5 : stat.label === 'xG' ? 0.2 : 1;
  const marked = stat.label === 'Possession' ? 12 : stat.label === 'xG' ? 0.7 : 3;
  if (gap <= balanced) return 'Équilibré';
  return `${gap >= marked ? 'Avantage net' : 'Léger avantage'} ${stat.home > stat.away ? home.short : away.short}`;
}

export function matchStatsSummary(stats: MatchStat[], home: Team, away: Team) {
  const messages: string[] = [];
  for (const label of ['Possession', 'Tirs cadrés', 'xG']) {
    const stat = stats.find((row) => row.label === label);
    if (!stat) continue;
    const reading = statReading(stat, home, away);
    if (!reading) continue;
    messages.push(`${label} : ${reading.toLowerCase()}`);
  }
  return messages.length
    ? `${messages.join(' · ')}. Ces indicateurs décrivent le match, sans déterminer seuls quelle équipe a dominé.`
    : null;
}

export function StatComparisonRow({ stat }: { stat: MatchStat }) {
  const home = stat.home != null && Number.isFinite(stat.home) && stat.home >= 0 ? stat.home : null;
  const away = stat.away != null && Number.isFinite(stat.away) && stat.away >= 0 ? stat.away : null;
  const total = home != null && away != null ? home + away : null;
  return (
    <div className="match-stat-row">
      <strong>{home == null ? '—' : `${number(home, 2)}${stat.unit ?? ''}`}</strong>
      <span className="match-stat-name">
        {stat.label}
        {explanations[stat.label] && (
          <details className="match-stat-help">
            <summary aria-label={`Comprendre ${stat.label}`}>ⓘ</summary>
            <p>{explanations[stat.label]}</p>
          </details>
        )}
      </span>
      <strong>{away == null ? '—' : `${number(away, 2)}${stat.unit ?? ''}`}</strong>
      {total != null && (
        <div
          className="match-stat-track"
          role="img"
          aria-label={`${stat.label} : domicile ${number(home, 2)}${stat.unit ?? ''}, extérieur ${number(away, 2)}${stat.unit ?? ''}`}
        >
          <span style={{ width: `${total === 0 ? 50 : (home! / total) * 100}%` }} />
          <span style={{ width: `${total === 0 ? 50 : (away! / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

export function MatchStatistics({ match, home, away }: { match: Match; home: Team; away: Team }) {
  const stats = validMatchStats(match.statistics);
  const periodScores = match.scoreBreakdown && (
    <div className="match-period-scores">
      {(
        [
          ['halftime', 'Mi-temps'],
          ['fulltime', 'Temps réglementaire'],
          ['extratime', 'Prolongations'],
          ['penalty', 'Tirs au but'],
        ] as const
      ).map(([key, label]) => {
        const value = match.scoreBreakdown?.[key];
        return value?.home != null && value.away != null ? (
          <p key={key}>
            <span>{label}</span>
            <strong>
              {value.home} – {value.away}
            </strong>
          </p>
        ) : null;
      })}
    </div>
  );
  if (!stats.length)
    return (
      <>
        {periodScores}
        <p className="data-note">
          {match.status === 'scheduled'
            ? 'Les statistiques de cette rencontre seront affichées après le coup d’envoi si une source les transmet.'
            : 'Aucune statistique détaillée de cette rencontre n’a été transmise.'}
        </p>
      </>
    );
  const used = new Set<string>();
  const sections = groups
    .map((group) => {
      const rows =
        group.title === 'Autres données fournies'
          ? stats.filter((stat) => !used.has(stat.label))
          : stats.filter((stat) => group.labels.includes(stat.label) && !used.has(stat.label));
      rows.forEach((row) => used.add(row.label));
      return { title: group.title, rows };
    })
    .filter((section) => section.rows.length);
  const quick = ['Possession', 'Tirs cadrés', 'xG'].flatMap((label) => {
    const stat = stats.find((row) => row.label === label);
    const reading = stat && statReading(stat, home, away);
    return reading ? [{ label, reading }] : [];
  });
  const summary = matchStatsSummary(stats, home, away);
  const primary = sections[0];
  return (
    <div className="match-stats-view">
      {periodScores}
      {summary && <p className="card padded match-stats-summary">{summary}</p>}
      {quick.length > 0 && (
        <section className="match-quick-read" aria-label="Lecture rapide">
          <h3>Lecture rapide</h3>
          <div>
            {quick.map((item) => (
              <p key={item.label}>
                <span>{item.label}</span>
                <strong>{item.reading}</strong>
              </p>
            ))}
          </div>
        </section>
      )}
      <div className="card match-stats-card">
        <div className="match-stat-header">
          <strong>{home.short}</strong>
          <span>{primary.title}</span>
          <strong>{away.short}</strong>
        </div>
        {primary.rows.map((stat) => (
          <StatComparisonRow key={stat.label} stat={stat} />
        ))}
      </div>
      {sections.length > 1 && (
        <details className="card padded match-stats-more">
          <summary>Voir toutes les statistiques</summary>
          <div className="match-stats-groups">
            {sections.slice(1).map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                {section.rows.map((stat) => (
                  <StatComparisonRow key={stat.label} stat={stat} />
                ))}
              </section>
            ))}
          </div>
        </details>
      )}
      <p className="data-note">
        Lecture rapide : écart de possession ≤ 5 points, de tirs cadrés ≤ 1 ou de xG ≤ 0,2 =
        équilibré ; avantage net à partir de 12 points, 3 tirs cadrés ou 0,7 xG. Un seul indicateur
        ne résume pas le match.
      </p>
    </div>
  );
}

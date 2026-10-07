import type { Match, MatchStat, Team } from '@/types/football';
import { number } from '@/lib/format';
import { statisticValue, sanitizeMatchStatistics, descriptiveRatios } from '@/lib/statistic-values';

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
      'Part des tirs cadrés',
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
      'Passes réussies (%) calculé',
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
    labels: [
      'Tacles',
      'Interceptions',
      'Dégagements',
      'Duels',
      'Duels gagnés',
      'Duels gagnés (%) calculé',
      'Arrêts',
    ],
  },
  { title: 'Discipline', labels: ['Fautes', 'Cartons jaunes', 'Cartons rouges'] },
  { title: 'Autres données fournies', labels: [] },
];
const explanations: Record<string, string> = {
  'Part des tirs cadrés':
    'Tirs cadrés divisés par le total des tirs disponibles. Ce ratio décrit le cadrage, pas la qualité des occasions ; un faible volume reste peu représentatif.',
  'Passes réussies (%) calculé':
    'Passes réussies divisées par les passes tentées recensées. Ratio calculé par Proba Match, distinct d’un éventuel taux transmis par la source.',
  'Duels gagnés (%) calculé':
    'Duels gagnés divisés par les duels recensés. Ratio descriptif calculé uniquement si les deux compteurs sont disponibles.',
  Possession:
    'Part du temps de possession attribuée à l’équipe par le fournisseur. Avoir davantage le ballon ne garantit pas davantage d’occasions.',
  Tirs: 'Tentatives de but recensées : cadrées, non cadrées et éventuellement bloquées selon la définition du fournisseur.',
  Corners:
    'Coups de pied de coin obtenus. Un nombre élevé ne suffit pas à démontrer une domination.',
  Fautes: 'Infractions commises recensées par le fournisseur.',
  'Cartons jaunes':
    'Avertissements recensés ; le traitement d’un second jaune peut varier selon la source.',
  'Cartons rouges':
    'Expulsions recensées. Le total peut inclure ou distinguer les seconds jaunes selon la source.',
  Passes: 'Tentatives de passe recensées ; ce volume dépend de la possession et du style de jeu.',
  'Passes réussies': 'Passes arrivées à un coéquipier selon la définition du fournisseur.',
  'Passes clés':
    'Passes conduisant directement à un tir ; elles ne sont pas nécessairement des passes décisives.',
  'Passes longues': 'Passes dépassant la distance minimale définie par le fournisseur.',
  'Passes dans le dernier tiers':
    'Passes recensées dans la partie du terrain la plus proche du but adverse.',
  Tacles:
    'Interventions au sol sur le porteur ; réussites et tentatives peuvent être distinguées selon la source.',
  Interceptions: 'Passes adverses coupées avant d’atteindre leur destinataire.',
  Dégagements: 'Ballons éloignés de la zone de danger, sans forcément chercher un coéquipier.',
  Duels: 'Confrontations directes recensées entre joueurs. Leur définition dépend du fournisseur.',
  'Duels gagnés': 'Duels remportés parmi ceux recensés par le fournisseur.',
  Arrêts:
    'Tirs stoppés par le gardien ; ne comprend pas nécessairement les tirs bloqués par des défenseurs.',
  'Tirs non cadrés':
    'Tentatives qui ne se dirigent pas dans le cadre du but ; les poteaux peuvent être traités à part.',
  'Tirs bloqués': 'Tentatives interceptées par un adversaire avant d’atteindre le but.',
  'Tirs dans la surface': 'Tentatives effectuées depuis l’intérieur de la surface de réparation.',
  'Tirs hors surface': 'Tentatives effectuées depuis l’extérieur de la surface de réparation.',
  'Hors-jeu': 'Positions de hors-jeu sanctionnées par l’arbitre.',
  Centres: 'Ballons envoyés depuis un côté du terrain vers la zone du but adverse.',
  'Grosses occasions':
    'Occasions jugées particulièrement favorables par le fournisseur ; ce classement est subjectif.',
  'Grosses occasions manquées':
    'Grosses occasions sans but, selon la définition propre au fournisseur.',
  Attaques: 'Séquences offensives comptabilisées par la source ; pas de définition universelle.',
  'Attaques dangereuses':
    'Séquences jugées menaçantes par la source ; indicateur à interpréter avec prudence.',

  xG: 'Somme des probabilités de but des occasions, estimées par le fournisseur. Ce chiffre décrit les tirs observés ; il est distinct des buts attendus avant-match de Proba Match.',
  xGOT: 'Qualité estimée des tirs cadrés selon leur placement.',
  'Tirs cadrés': 'Tirs qui auraient fini dans le but sans intervention du gardien.',
  'Précision des passes': 'Pourcentage de passes réussies.',
  PPDA: 'Passes adverses par action défensive dans une zone définie par le fournisseur. Une valeur plus faible peut indiquer un pressing plus intense ; les définitions varient.',
  'Field tilt': 'Part de possession territoriale dans le dernier tiers.',
};

export function validMatchStats(stats: MatchStat[]) {
  return sanitizeMatchStatistics(stats);
}

export function statReading(stat: MatchStat, home: Team, away: Team) {
  if (
    statisticValue(stat.label, stat.home, stat.unit) === null ||
    statisticValue(stat.label, stat.away, stat.unit) === null
  )
    return null;
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
  const home = statisticValue(stat.label, stat.home, stat.unit);
  const away = statisticValue(stat.label, stat.away, stat.unit);
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
  const observed = match.status === 'scheduled' ? [] : validMatchStats(match.statistics);
  const stats = [...observed, ...descriptiveRatios(observed)];
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
        return match.status !== 'scheduled' &&
          value?.home != null &&
          value.away != null &&
          Number.isSafeInteger(value.home) &&
          value.home >= 0 &&
          Number.isSafeInteger(value.away) &&
          value.away >= 0 ? (
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
            : 'Aucune statistique détaillée exploitable n’est disponible pour cette rencontre.'}
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
      {match.detailFallback?.includes('statistics') && (
        <p className="warning" role="status">
          La dernière réponse n’a pas fourni ces statistiques. Les anciennes valeurs sont conservées
          ; leur fraîcheur n’est pas confirmée.
        </p>
      )}
      <p className="data-note">
        Dernière réception des statistiques :{' '}
        {match.detailObservedAt?.statistics?.slice(0, 10) ?? 'date non confirmée'}.
      </p>
      <p className="data-note">
        Statistiques observées transmises par le fournisseur, distinctes des probabilités calculées
        avant le match. Une donnée manquante n’est pas un zéro. Les définitions peuvent varier entre
        sources. Les ratios indiqués « calculé » sont descriptifs et ne modifient pas la prédiction
        avant-match.
      </p>
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

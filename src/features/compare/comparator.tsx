'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Dataset } from '@/types/football';
import { SourceBanner } from '@/components/source-banner';
import { Empty, SectionTitle, TeamBadge } from '@/components/ui';
import type { comparisonView } from '@/services/football/read-model';
import { number } from '@/lib/format';
import { RadarChart } from '@/components/charts';
import { playerPerformance } from '@/prediction-engine/player';
export function Comparator({
  data,
  kind,
  initialA,
  initialB,
  playerChoices,
  summaries,
  periodMode = 'catalogue',
  commonPeriod,
}: {
  data: Dataset;
  kind: 'teams' | 'players';
  initialA?: string;
  initialB?: string;
  playerChoices?: { id: string; name: string }[];
  summaries: ReturnType<typeof comparisonView>;
  periodMode?: 'catalogue' | 'common';
  commonPeriod?: { from?: string; to?: string };
}) {
  const router = useRouter();
  const items = kind === 'teams' ? data.teams : (playerChoices ?? data.players);
  const [a, setA] = useState(
    items.some((i) => i.id === initialA) ? initialA! : (items[0]?.id ?? ''),
  );
  const [b, setB] = useState(
    items.some((i) => i.id === initialB) ? initialB! : (items.find((i) => i.id !== a)?.id ?? ''),
  );
  const [search, setSearch] = useState('');
  const [detailed, setDetailed] = useState(false);
  const profiles = kind === 'teams' ? data.teams : data.players;
  const A = profiles.find((i) => i.id === a),
    B = profiles.find((i) => i.id === b);
  function choose(nextA: string, nextB: string) {
    // A common window belongs to the server-selected pair; keep that pair until navigation resolves.
    if (kind === 'players' || periodMode !== 'common') {
      setA(nextA);
      setB(nextB);
    }
    router.replace(
      `/comparateur/${kind === 'teams' ? 'equipes' : 'joueurs'}?${new URLSearchParams({ a: nextA, b: nextB, ...(kind === 'teams' ? { period: periodMode } : {}) })}`,
      {
        scroll: false,
      },
    );
  }
  function options(selected: string) {
    const matches = items
      .filter((i) => i.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
      .slice(0, 50);
    const current = items.find((i) => i.id === selected);
    return [...new Map([...(current ? [current] : []), ...matches].map((i) => [i.id, i])).values()];
  }
  let rows: [string, number | null | undefined, number | null | undefined][] = [];
  let radar: { labels: string[]; a: number[]; b: number[] } | null = null;
  if (kind === 'teams' && A && B) {
    const sa = summaries[a].all,
      sb = summaries[b].all;
    const ha = summaries[a].home,
      hb = summaries[b].home,
      aa = summaries[a].away,
      ab = summaries[b].away;
    rows = [
      ['Matchs disponibles', sa.played, sb.played],
      ['Buts marqués', sa.played ? sa.scored : null, sb.played ? sb.scored : null],
      ['Buts encaissés', sa.played ? sa.conceded : null, sb.played ? sb.conceded : null],
      ['Buts par match', sa.goalsPerGame, sb.goalsPerGame],
      ['Buts encaissés par match', sa.concededPerGame, sb.concededPerGame],
      ['Clean sheets', sa.played ? sa.cleanSheets : null, sb.played ? sb.cleanSheets : null],
      [
        'Victoires (%)',
        sa.winRate === null ? null : sa.winRate * 100,
        sb.winRate === null ? null : sb.winRate * 100,
      ],
      ['Buts/match à domicile', ha.goalsPerGame, hb.goalsPerGame],
      ['Buts/match à l’extérieur', aa.goalsPerGame, ab.goalsPerGame],
      ['xG moyen disponible', summaries[a].xg, summaries[b].xg],
      ['Possession moyenne', summaries[a].possession, summaries[b].possession],
      ['Tirs moyens', summaries[a].shots, summaries[b].shots],
    ];
    if (sa.played && sb.played) {
      const norm = (s: typeof sa) => [
        Math.min(100, s.goalsPerGame! * 33),
        Math.max(0, 100 - s.concededPerGame! * 25),
        s.winRate! * 100,
        (s.cleanSheets / s.played) * 100,
        s.form.reduce((n, f) => n + (f === 'V' ? 20 : f === 'N' ? 6.67 : 0), 0),
      ];
      radar = {
        labels: ['Attaque', 'Défense', 'Victoires', 'Clean sheets', 'Forme'],
        a: norm(sa),
        b: norm(sb),
      };
    }
  }
  if (kind === 'players' && A && B && 'stats' in A && 'stats' in B) {
    const pa = A,
      pb = B;
    rows = [
      ['Matchs', pa.stats.appearances, pb.stats.appearances],
      ['Minutes', pa.stats.minutes, pb.stats.minutes],
      ['Titularisations', pa.stats.starts, pb.stats.starts],
      ['Buts', pa.stats.goals, pb.stats.goals],
      ['Passes décisives', pa.stats.assists, pb.stats.assists],
      [
        'Buts / 90 min',
        pa.stats.minutes && pa.stats.goals !== null
          ? (pa.stats.goals * 90) / pa.stats.minutes
          : null,
        pb.stats.minutes && pb.stats.goals !== null
          ? (pb.stats.goals * 90) / pb.stats.minutes
          : null,
      ],
      ['Tirs', pa.stats.shots, pb.stats.shots],
      ['xG', pa.stats.xg, pb.stats.xg],
      ['xA', pa.stats.xa, pb.stats.xa],
      ['Tacles', pa.stats.tackles, pb.stats.tackles],
      ['Interceptions', pa.stats.interceptions, pb.stats.interceptions],
      ['Arrêts (gardiens)', pa.stats.saves, pb.stats.saves],
      ['Buts encaissés (gardiens)', pa.stats.conceded, pb.stats.conceded],
      ['Note moyenne de la source', pa.stats.rating, pb.stats.rating],
      [
        'Indice adapté au poste',
        playerPerformance(pa.stats, pa.position),
        playerPerformance(pb.stats, pb.position),
      ],
    ];
  }
  return (
    <div className="page">
      <SourceBanner data={data} />
      <span className="eyebrow">METTRE LES CHIFFRES EN PERSPECTIVE</span>
      <h1>Comparer deux {kind === 'teams' ? 'équipes' : 'joueurs'}</h1>
      <nav className="segmented space-top">
        <Link
          className={`button ${kind === 'teams' ? '' : 'secondary'}`}
          href="/comparateur/equipes"
        >
          Équipes
        </Link>
        <Link
          className={`button ${kind === 'players' ? '' : 'secondary'}`}
          href="/comparateur/joueurs"
        >
          Joueurs
        </Link>
      </nav>
      <p className="intro-text">
        Choisissez deux profils pour comparer leurs volumes de jeu, leur forme et leurs forces. Les
        données manquantes restent signalées.
      </p>
      {kind === 'teams' && A && B && (
        <div className="card padded">
          <h2>Périmètre des chiffres</h2>
          <p className="data-note">
            {periodMode === 'common'
              ? `Période commune : ${commonPeriod?.from?.slice(0, 10) ?? 'indisponible'} à ${commonPeriod?.to?.slice(0, 10) ?? 'indisponible'}.`
              : 'Historique disponible du catalogue, pouvant couvrir plusieurs saisons et compétitions.'}
            Les échantillons peuvent différer, même à période identique. Une période commune ne
            garantit pas des adversaires ou des compétitions comparables.
          </p>
          <form action="/comparateur/equipes" method="get" className="catalog-search">
            <input type="hidden" name="a" value={a} />
            <input type="hidden" name="b" value={b} />
            <label htmlFor="comparison-period">Période comparée</label>
            <select
              id="comparison-period"
              name="period"
              defaultValue={periodMode}
              style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
            >
              <option value="catalogue">Tout l’historique disponible</option>
              <option value="common">Période commune aux deux équipes</option>
            </select>
            <button type="submit" className="button secondary">
              Appliquer la période
            </button>
          </form>
          {periodMode === 'common' && !commonPeriod?.from && (
            <p className="warning">
              Aucune période commune : les statistiques comparées sont indisponibles.
            </p>
          )}
          {[A, B].map((team) => (
            <p className="data-note" key={team.id}>
              {team.name} : {summaries[team.id].all.played} résultats ; période{' '}
              {summaries[team.id].period.from?.slice(0, 10) ?? 'indisponible'} à{' '}
              {summaries[team.id].period.to?.slice(0, 10) ?? 'indisponible'} ;{' '}
              {Object.entries(summaries[team.id].coverage)
                .map(
                  ([label, value]) =>
                    `${label} : ${value.sample} matchs documentés, ${value.from?.slice(0, 10) ?? 'date inconnue'} à ${value.to?.slice(0, 10) ?? 'date inconnue'}, source ${value.sources.join(', ') || 'indisponible'}`,
                )
                .join(' · ')}
            </p>
          ))}
        </div>
      )}
      {kind === 'players' && A && B && 'stats' in A && 'stats' in B && (
        <div className="card padded">
          <h2>Périmètre des relevés joueurs</h2>
          {[A, B].map((player) => (
            <p className="data-note" key={player.id}>
              {player.name} :{' '}
              {player.statsScope?.verified
                ? `saison ${player.statsScope.season}, compétition ${data.competitions.find((c) => c.id === player.statsScope!.competitionId)?.name ?? player.statsScope.competitionId}, équipe ${data.teams.find((t) => t.id === player.statsScope!.teamId)?.name ?? player.statsScope.teamId}, source ${player.statsScope.source}, relevé reçu le ${player.statsScope.observedAt.slice(0, 10)}`
                : 'périmètre non confirmé par la source'}
              .
            </p>
          ))}
          {(!A.statsScope?.verified ||
            !B.statsScope?.verified ||
            A.statsScope.season !== B.statsScope.season ||
            A.statsScope.competitionId !== B.statsScope.competitionId) && (
            <p className="warning">
              Ces relevés ne confirment pas une saison et une compétition communes. Ils ne
              permettent pas un classement équitable entre ces joueurs.
            </p>
          )}
        </div>
      )}
      <div className="suggestions" role="group" aria-label="Comparaisons suggérées">
        {items.slice(1, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => {
              choose(items[0].id, item.id);
            }}
          >
            {items[0].name} / {item.name}
          </button>
        ))}
      </div>
      <label className="catalog-search">
        Rechercher dans les profils
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom d’une équipe ou d’un joueur"
        />
      </label>
      <div className="comparison-selectors card">
        <label>
          {kind === 'teams' ? 'Première équipe' : 'Premier joueur'}
          <select value={a} onChange={(e) => choose(e.target.value, b)}>
            {options(a).map((i) => (
              <option value={i.id} key={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <strong>VS</strong>
        <label>
          {kind === 'teams' ? 'Deuxième équipe' : 'Deuxième joueur'}
          <select value={b} onChange={(e) => choose(a, e.target.value)}>
            {options(b).map((i) => (
              <option value={i.id} key={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {A && B ? (
        a === b ? (
          <Empty title="Choisissez deux profils différents" />
        ) : (
          <>
            <SectionTitle title={`${A.name} / ${B.name}`} />
            <div className="segmented" role="group" aria-label="Niveau de détail">
              <button aria-pressed={!detailed} onClick={() => setDetailed(false)}>
                L’essentiel
              </button>
              <button aria-pressed={detailed} onClick={() => setDetailed(true)}>
                Toutes les statistiques
              </button>
            </div>
            {radar && (
              <p className="data-note">
                {A.name} présente une valeur plus favorable sur{' '}
                {radar.a.filter((v, i) => v > radar!.b[i]).length} des {radar.labels.length} axes
                calculés. Ce constat décrit les matchs disponibles et ne prédit pas le vainqueur.
              </p>
            )}
            {kind === 'players' &&
              'position' in A &&
              'position' in B &&
              A.position !== B.position && (
                <p className="warning">
                  Postes différents : {A.position} et {B.position}. Les indices adaptés au poste ne
                  constituent pas un classement absolu entre ces deux joueurs.
                </p>
              )}
            <div className={radar ? 'detail-columns' : ''}>
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
                      <th>
                        <span className="comparison-team">
                          {'color' in A && <TeamBadge team={A} size={26} />}
                          {A.name}
                        </span>
                      </th>
                      <th>
                        <span className="comparison-team">
                          {'color' in B && <TeamBadge team={B} size={26} />}
                          {B.name}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailed
                      ? rows
                      : rows.filter(
                          ([label], index) =>
                            index < 6 ||
                            (kind === 'players' &&
                              'position' in A &&
                              A.position === 'Gardien' &&
                              label.includes('gardiens')),
                        )
                    ).map(([label, va, vb]) => (
                      <tr key={label}>
                        <th>{label}</th>
                        <td>{number(va, 2)}</td>
                        <td>{number(vb, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {radar && (
                <details className="card advanced-panel">
                  <summary>Le profil des équipes</summary>
                  <RadarChart {...radar} names={[A.name, B.name]} />
                  <p className="data-note">
                    Échelles illustratives fixes : attaque = buts/match × 33 ; défense = 100 − buts
                    encaissés/match × 25 ; autres axes en pourcentage. Valeurs bornées à 0–100,
                    calculées sur les matchs disponibles.
                  </p>
                </details>
              )}
            </div>
            <p className="data-note">
              Comparez toujours les volumes de jeu, le poste et la couverture des données. Les
              métriques indisponibles ne sont pas remplacées par zéro.
            </p>
          </>
        )
      ) : kind === 'players' && items.length >= 2 ? (
        <p role="status">Chargement des statistiques…</p>
      ) : (
        <Empty />
      )}
    </div>
  );
}

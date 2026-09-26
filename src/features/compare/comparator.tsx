'use client';
import Link from 'next/link';
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
  summaries,
}: {
  data: Dataset;
  kind: 'teams' | 'players';
  initialA?: string;
  summaries: ReturnType<typeof comparisonView>;
}) {
  const items = kind === 'teams' ? data.teams : data.players;
  const [a, setA] = useState(
    items.some((i) => i.id === initialA) ? initialA! : (items[0]?.id ?? ''),
  );
  const [b, setB] = useState(items.find((i) => i.id !== a)?.id ?? '');
  const [search, setSearch] = useState('');
  const [detailed, setDetailed] = useState(false);
  const A = items.find((i) => i.id === a),
    B = items.find((i) => i.id === b);
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
      <div className="suggestions" aria-label="Comparaisons suggérées">
        {items.slice(1, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setA(items[0].id);
              setB(item.id);
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
          <select value={a} onChange={(e) => setA(e.target.value)}>
            {items
              .filter(
                (i) =>
                  i.id === a || i.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((i) => (
                <option value={i.id} key={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
        </label>
        <strong>VS</strong>
        <label>
          {kind === 'teams' ? 'Deuxième équipe' : 'Deuxième joueur'}
          <select value={b} onChange={(e) => setB(e.target.value)}>
            {items
              .filter(
                (i) =>
                  i.id === b || i.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((i) => (
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
      ) : (
        <Empty />
      )}
    </div>
  );
}

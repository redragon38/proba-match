'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CompetitionView } from '@/services/competition-view';
import { SourceBanner } from '@/components/source-banner';
import { FavoriteButton } from '@/features/favorites';
import { Metric, SectionTitle, TeamBadge } from '@/components/ui';
import { StandingTable } from './standing-table';
import { MatchList } from '@/features/matches/match-list';
import { Breadcrumbs } from '@/components/breadcrumbs';

export function CompetitionProfile({ view }: { view: CompetitionView }) {
  const router = useRouter(),
    params = useSearchParams();
  const {
    competition: c,
    seasons,
    mode,
    matches,
    teams,
    passers,
    scorers,
    table,
    metrics,
    source: data,
  } = view;
  function setMode(value: string) {
    const query = new URLSearchParams(params.toString());
    query.set('statut', value);
    router.replace(`?${query}`, { scroll: false });
  }
  const attack = [...table]
    .filter((r) => r.played > 0)
    .sort((a, b) => b.scored / b.played - a.scored / a.played)[0];
  const defense = [...table]
    .filter((r) => r.played > 0)
    .sort((a, b) => a.conceded / a.played - b.conceded / b.played)[0];
  return (
    <div className="page">
      <SourceBanner data={data} />
      <Breadcrumbs
        items={[
          { name: 'Compétitions', href: '/competitions' },
          { name: c.name, href: `/competition/${c.slug}` },
        ]}
        real={data.source !== 'demo'}
      />
      <div className="card profile-header">
        <span className="competition-icon large">{c.flag}</span>
        <div>
          <span className="eyebrow">
            {c.country} · SAISON {c.season}/{c.season + 1}
          </span>
          <h1>{c.name}</h1>
          <p>Le classement, les rencontres et ceux qui font la différence.</p>
        </div>
        <FavoriteButton id={`competition:${c.id}`} label={c.name} />
      </div>
      <label className="season-picker">
        Saison
        <select
          value={c.season}
          onChange={(e) => {
            const query = new URLSearchParams(params.toString());
            query.set('saison', e.target.value);
            query.delete('statut');
            router.replace(`?${query}`, { scroll: false });
          }}
        >
          {seasons.map((year) => (
            <option value={year} key={year}>
              {year}/{year + 1}
            </option>
          ))}
        </select>
      </label>
      <nav className="profile-tabs" aria-label="Rubriques de la compétition">
        {[
          ['classement', 'Classement'],
          ['matchs', 'Matchs'],
          ['equipes', 'Équipes'],
          ['joueurs', 'Joueurs'],
        ].map(([id, label]) => (
          <a href={`#${id}`} key={id}>
            {label}
          </a>
        ))}
      </nav>
      <div className="metrics">
        <Metric label="Équipes dans le catalogue" value={teams.length} />
        <Metric label="Rencontres disponibles" value={metrics.matches} />
        <Metric label="Matchs terminés" value={metrics.finished} />
        <Metric label="Buts recensés" value={metrics.goals ?? 'Non disponible'} />
      </div>
      <div id="classement">
        <SectionTitle title="Classement" />
      </div>
      <div className="metrics three">
        <Metric
          label="Meilleure attaque · buts/match"
          value={attack ? (attack.scored / attack.played).toFixed(2) : 'Non disponible'}
          note={teams.find((t) => t.id === attack?.teamId)?.name}
        />
        <Metric
          label="Meilleure défense · buts encaissés/match"
          value={defense ? (defense.conceded / defense.played).toFixed(2) : 'Non disponible'}
          note={teams.find((t) => t.id === defense?.teamId)?.name}
        />
        <Metric
          label="Meilleur passeur disponible"
          value={passers[0]?.name ?? 'Non disponible'}
          note={passers[0] ? `${passers[0].stats.assists} passes décisives` : undefined}
        />
      </div>
      <StandingTable rows={table} teams={teams} />
      <p className="data-note">
        {data.source === 'demo'
          ? 'Classement fictif calculé à partir du calendrier de démonstration.'
          : data.source === 'openfootball'
            ? 'Classement Proba Match calculé sur les résultats OpenFootball disponibles, sans sanctions administratives ni règles spécifiques de départage.'
            : 'Classement transmis par API-Football. Les formats à plusieurs groupes peuvent ne pas être disponibles.'}
      </p>
      <div className="detail-columns">
        <div>
          <div id="matchs">
            <SectionTitle title="Matchs" />
          </div>
          <div className="segmented">
            <button
              className={mode === 'scheduled' ? 'active' : ''}
              onClick={() => setMode('scheduled')}
            >
              Calendrier
            </button>
            <button
              className={mode === 'finished' ? 'active' : ''}
              onClick={() => setMode('finished')}
            >
              Résultats
            </button>
            <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>
              En direct
            </button>
          </div>
          <MatchList matches={matches} teams={teams} competitions={[c]} predictions={{}} />
          <div id="equipes">
            <SectionTitle title="Équipes" />
          </div>
          <div className="catalog-grid">
            {teams.map((t) => (
              <Link className="card catalog-item" key={t.id} href={`/equipe/${t.slug}`}>
                <TeamBadge team={t} />
                <h3>{t.name}</h3>
              </Link>
            ))}
          </div>
        </div>
        <aside id="joueurs">
          <SectionTitle title="Meilleurs passeurs disponibles" />
          <section className="card padded">
            {passers.map((p) => (
              <Link className="squad-row" href={`/joueur/${p.slug}`} key={p.id}>
                <strong>{p.name}</strong>
                <b>{p.stats.assists}</b>
              </Link>
            ))}
            {!passers.length && <p className="data-note">Non disponible</p>}
          </section>
          <SectionTitle title="Meilleurs buteurs disponibles" />
          <section className="card padded">
            {scorers.map((p, i) => (
              <Link className="player-ranking" key={p.id} href={`/joueur/${p.slug}`}>
                <span>{i + 1}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{teams.find((t) => t.id === p.teamId)?.short}</small>
                </span>
                <b>{p.stats.goals}</b>
              </Link>
            ))}
            {!scorers.length && <p className="data-note">Non disponible</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

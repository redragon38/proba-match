'use client';
import { useState } from 'react';
import type { Dataset } from '@/types/football';
import { SourceBanner } from '@/components/source-banner';
import { Empty } from '@/components/ui';
import { useFavorites } from '@/features/favorites';
import { useLive } from './use-live';
import { MatchCard } from './match-card';
import Link from 'next/link';
import { LocalTime } from '@/components/local-time';
export function LivePage({ data }: { data: Dataset }) {
  const live = useLive(data.matches),
    { values } = useFavorites();
  const [competition, setCompetition] = useState('all'),
    [country, setCountry] = useState('all'),
    [favorites, setFavorites] = useState(false);
  const matches = live.matches.filter(
    (m) =>
      m.status === 'live' &&
      (competition === 'all' || m.competitionId === competition) &&
      (country === 'all' ||
        data.competitions.find((c) => c.id === m.competitionId)?.country === country) &&
      (!favorites ||
        [
          `match:${m.id}`,
          `team:${m.homeId}`,
          `team:${m.awayId}`,
          `competition:${m.competitionId}`,
        ].some((id) => values.includes(id))),
  );
  return (
    <div className="page">
      <SourceBanner data={data} />
      <span className="eyebrow">AU RYTHME DU TERRAIN</span>
      <h1>Le football en direct.</h1>
      <p className="intro-text">
        Scores, moments forts et statistiques disponibles. Chaque changement de score est mis en
        évidence.
      </p>
      <div className="live-health" role="status">
        {matches.length > 0 && !live.error && !live.degraded && !data.degraded && (
          <i className="live-dot" aria-hidden="true" />
        )}
        {live.error
          ? 'Connexion interrompue · derniers scores conservés'
          : live.degraded || data.degraded
            ? 'Données du fournisseur en retard · derniers scores conservés'
            : `${matches.length} rencontre(s) en cours · actualisation toutes les 30 secondes`}
        {live.checkedAt && (
          <span>Vérifié à {new Date(live.checkedAt).toLocaleTimeString('fr-FR')}</span>
        )}
      </div>
      <div className="filter-panel">
        <label>
          Pays
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="all">Tous les pays</option>
            {[...new Set(data.competitions.map((c) => c.country))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Compétition
          <select value={competition} onChange={(e) => setCompetition(e.target.value)}>
            <option value="all">Toutes les compétitions</option>
            {data.competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`button ${favorites ? '' : 'secondary'}`}
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          Mes matchs
        </button>
      </div>
      <div className="sport-card-grid">
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            teams={data.teams}
            competition={data.competitions.find((c) => c.id === m.competitionId)}
            changed={live.changed.includes(m.id)}
          />
        ))}
      </div>
      {!matches.length && (
        <div className="card">
          <Empty
            title={
              competition !== 'all' || country !== 'all' || favorites
                ? 'Aucun match pour ces filtres'
                : 'Aucun match en direct'
            }
            text="Aucune rencontre en direct pour cette sélection. Modifiez les filtres ou consultez les matchs du jour."
          />
          <div className="empty-actions">
            {competition !== 'all' || country !== 'all' || favorites ? (
              <button
                className="button secondary"
                onClick={() => {
                  setCompetition('all');
                  setCountry('all');
                  setFavorites(false);
                }}
              >
                Afficher toutes les compétitions
              </button>
            ) : (
              <Link className="button" href="/matchs">
                Voir les matchs du jour
              </Link>
            )}
          </div>
          {data.matches
            .filter((m) => m.status === 'scheduled')
            .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
            .slice(0, 1)
            .map((m) => (
              <p className="data-note" key={m.id}>
                Prochain match disponible :{' '}
                <LocalTime iso={m.kickoff} date known={m.kickoffKnown} sourceDate={m.sourceDate} />{' '}
                à <LocalTime iso={m.kickoff} known={m.kickoffKnown} />.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

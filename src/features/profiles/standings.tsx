'use client';
import { competitionSeason } from '@/lib/competition-season';
import { useState } from 'react';
import { SourceBanner } from '@/components/source-banner';
import { Empty } from '@/components/ui';
import { StandingTable } from './standing-table';
import type { standingsView } from '@/services/football/read-model';
export function Standings({ data, seasons, tables }: ReturnType<typeof standingsView>) {
  const [scope, setScope] = useState<'all' | 'home' | 'away' | 'last5'>('all');
  const [country, setCountry] = useState('all'),
    [competition, setCompetition] = useState(data.competitions[0]?.id ?? ''),
    [season, setSeason] = useState(String(data.competitions[0]?.season ?? ''));
  const comps = data.competitions.filter((c) => country === 'all' || c.country === country);
  const selected = comps.find((c) => c.id === competition);
  return (
    <div className="page">
      <SourceBanner data={data} />
      <span className="eyebrow">LA SAISON, EN CHIFFRES</span>
      <h1>Classements</h1>
      <div className="filter-panel space-top">
        <label>
          Pays
          <select
            aria-label="Pays"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              const c = data.competitions.find(
                (c) => e.target.value === 'all' || c.country === e.target.value,
              );
              setCompetition(c?.id ?? '');
              setSeason(String(c?.season ?? ''));
            }}
          >
            <option value="all">Tous les pays</option>
            {[...new Set(data.competitions.map((c) => c.country))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Compétition
          <select
            aria-label="Compétition"
            value={competition}
            onChange={(e) => {
              setCompetition(e.target.value);
              setSeason(
                String(data.competitions.find((c) => c.id === e.target.value)?.season ?? ''),
              );
            }}
          >
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Saison
          <select aria-label="Saison" value={season} onChange={(e) => setSeason(e.target.value)}>
            {(seasons[competition] ?? []).map((y) => (
              <option key={y} value={y}>
                {competitionSeason(selected, y)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="suggestions" role="group" aria-label="Périmètre du classement">
        {(
          [
            ['all', 'Général'],
            ['home', 'Domicile'],
            ['away', 'Extérieur'],
            ['last5', '5 derniers matchs'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-pressed={scope === id} onClick={() => setScope(id)}>
            {label}
          </button>
        ))}
      </div>
      {scope !== 'all' && (
        <p className="data-note">
          Calcul Proba Match sur les rencontres synchronisées de la compétition. Ce sous-classement
          peut être partiel et ne reprend pas les sanctions ou départages officiels.
        </p>
      )}
      {selected ? (
        <StandingTable
          rows={tables[`${selected.id}:${season}:${scope === 'all' ? 'general' : scope}`] ?? []}
          teams={data.teams}
        />
      ) : (
        <Empty />
      )}
      <p className="data-note">
        MJ : matchs joués · G : gagnés · N : nuls · P : perdus · BP/BC : buts pour/contre. Seules
        les saisons synchronisées sont proposées.
      </p>
    </div>
  );
}

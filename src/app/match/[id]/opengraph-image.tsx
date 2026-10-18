import { ImageResponse } from 'next/og';
import { getDataset } from '@/services/football';
import { getPredictions } from '@/services/predictions';
import { absoluteUrl } from '@/lib/seo';
import { probabilityPercentages } from '@/lib/probability-format';

export const alt = 'Analyse statistique avant-match — Proba Match';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDataset();
  const match = data.matches.find((row) => row.slug === id || row.id === id);
  if (!match)
    return new ImageResponse(<div style={{ display: 'flex', padding: 80 }}>Proba Match</div>, size);
  const home = data.teams.find((team) => team.id === match.homeId)!;
  const away = data.teams.find((team) => team.id === match.awayId)!;
  const competition = data.competitions.find((item) => item.id === match.competitionId);
  const prediction = (await getPredictions(data, new Set([match.id]), false))[match.id];
  const percentages = prediction
    ? probabilityPercentages(prediction.home, prediction.draw, prediction.away)
    : null;
  const logo = (team: typeof home) =>
    team.logo ? (team.logo.startsWith('/') ? absoluteUrl(team.logo) : team.logo) : null;
  const badge = (team: typeof home) => (
    <div
      style={{
        display: 'flex',
        width: 150,
        height: 150,
        borderRadius: 75,
        alignItems: 'center',
        justifyContent: 'center',
        background: team.color || '#163b32',
        fontSize: 42,
        fontWeight: 800,
        overflow: 'hidden',
      }}
    >
      {logo(team) ? (
        <img src={logo(team)!} width="120" height="120" alt="" style={{ objectFit: 'contain' }} />
      ) : (
        team.short.slice(0, 3)
      )}
    </div>
  );
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '54px 68px',
        color: '#f5faf8',
        background: '#0d1517',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: '#6fe0a8',
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        <span>PROBA MATCH</span>
        <span>{competition?.name ?? 'Football'}</span>
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 34,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 430,
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            textAlign: 'center',
          }}
        >
          {badge(home)}
          <span style={{ fontSize: home.name.length > 24 ? 38 : 48, fontWeight: 800 }}>
            {home.name}
          </span>
        </div>
        <span style={{ fontSize: 44, color: '#93a5a3' }}>–</span>
        <div
          style={{
            display: 'flex',
            width: 430,
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            textAlign: 'center',
          }}
        >
          {badge(away)}
          <span style={{ fontSize: away.name.length > 24 ? 38 : 48, fontWeight: 800 }}>
            {away.name}
          </span>
        </div>
      </div>
      {percentages ? (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 42, fontSize: 27 }}>
          <span>
            {home.short} {percentages[0]} %
          </span>
          <span>Nul {percentages[1]} %</span>
          <span>
            {away.short} {percentages[2]} %
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', fontSize: 26 }}>
          Fiche de la rencontre
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 20,
          color: '#a8b7b5',
          fontSize: 22,
        }}
      >
        Estimation statistique ·{' '}
        {new Date(match.kickoff).toLocaleDateString('fr-FR', {
          dateStyle: 'long',
          timeZone: 'Europe/Paris',
        })}
      </div>
    </div>,
    size,
  );
}

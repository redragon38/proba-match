import type { Competition, Dataset, Match, Player, Team } from '@/types/football';
import { dateKey, slugify } from '@/lib/format';

export const competitions: Competition[] = [
  { id: '61', slug: 'ligue-1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', season: 2026 },
  {
    id: '39',
    slug: 'premier-league',
    name: 'Premier League',
    country: 'Angleterre',
    flag: '🏴',
    season: 2026,
  },
  { id: '140', slug: 'la-liga', name: 'La Liga', country: 'Espagne', flag: '🇪🇸', season: 2026 },
  { id: '135', slug: 'serie-a', name: 'Serie A', country: 'Italie', flag: '🇮🇹', season: 2026 },
  {
    id: '78',
    slug: 'bundesliga',
    name: 'Bundesliga',
    country: 'Allemagne',
    flag: '🇩🇪',
    season: 2026,
  },
  {
    id: '2',
    slug: 'ligue-des-champions',
    name: 'Ligue des champions',
    country: 'Europe',
    flag: '🇪🇺',
    season: 2026,
  },
];
const teamRows = [
  [
    'paris-saint-germain',
    'Paris Saint-Germain',
    'PSG',
    '#173c79',
    '61',
    'Parc des Princes',
    'Luis Enrique',
  ],
  [
    'olympique-de-marseille',
    'Olympique de Marseille',
    'OM',
    '#159dce',
    '61',
    'Orange Vélodrome',
    'Roberto De Zerbi',
  ],
  ['as-monaco', 'AS Monaco', 'ASM', '#d94351', '61', 'Stade Louis-II', 'Sébastien Moreau'],
  [
    'olympique-lyonnais',
    'Olympique Lyonnais',
    'OL',
    '#294a9d',
    '61',
    'Groupama Stadium',
    'Julien Laurent',
  ],
  ['losc-lille', 'LOSC Lille', 'LOSC', '#bd1d38', '61', 'Stade Pierre-Mauroy', 'Bruno Génésio'],
  ['rc-lens', 'RC Lens', 'RCL', '#c7941c', '61', 'Stade Bollaert-Delelis', 'Pierre Martin'],
  ['arsenal', 'Arsenal', 'ARS', '#c72938', '39', 'Emirates Stadium', 'Mikel Arteta'],
  ['chelsea', 'Chelsea', 'CHE', '#2852b6', '39', 'Stamford Bridge', 'James Cooper'],
  ['manchester-city', 'Manchester City', 'MCI', '#70a5c8', '39', 'Etihad Stadium', 'Pep Guardiola'],
  ['liverpool', 'Liverpool', 'LIV', '#c32336', '39', 'Anfield', 'Arne Slot'],
  ['real-madrid', 'Real Madrid', 'RMA', '#b89c4c', '140', 'Santiago Bernabéu', 'Alejandro Ruiz'],
  ['fc-barcelone', 'FC Barcelone', 'BAR', '#9a295d', '140', 'Camp Nou', 'Hansi Flick'],
  ['inter-milan', 'Inter Milan', 'INT', '#2160a2', '135', 'San Siro', 'Marco Conti'],
  ['ac-milan', 'AC Milan', 'MIL', '#c32b36', '135', 'San Siro', 'Luca Rossi'],
  ['bayern-munich', 'Bayern Munich', 'FCB', '#c33146', '78', 'Allianz Arena', 'Vincent Kompany'],
  [
    'borussia-dortmund',
    'Borussia Dortmund',
    'BVB',
    '#bda71b',
    '78',
    'Signal Iduna Park',
    'Felix Wagner',
  ],
];
export const teams: Team[] = teamRows.map(
  ([slug, name, short, color, competitionId, venue, coach], i) => ({
    id: `t${i + 1}`,
    slug,
    name,
    short,
    color,
    competitionId,
    venue,
    coach,
    country: competitions.find((c) => c.id === competitionId)!.country,
  }),
);
const stars = [
  'Ousmane Dembélé',
  'Mason Greenwood',
  'Maghnes Akliouche',
  'Corentin Tolisso',
  'Jonathan Perrin',
  'Florian Garnier',
  'Bukayo Saka',
  'Cole Palmer',
  'Erling Haaland',
  'Mohamed Salah',
  'Kylian Mbappé',
  'Lamine Yamal',
  'Lautaro Martínez',
  'Rafael Leão',
  'Harry Kane',
  'Julian Brandt',
];
export const players: Player[] = teams.flatMap((team, i) =>
  Array.from({ length: 16 }, (_, j) => {
    const name =
      j === 10
        ? stars[i]
        : `${['Lucas', 'Gabriel', 'Adam', 'Noah', 'Louis', 'Arthur', 'Jules', 'Hugo', 'Raphaël', 'Ethan', 'Victor', 'Léo', 'Oscar', 'Nathan', 'Paul', 'Alex'][j]} ${['Martin', 'Bernard', 'Silva', 'Dubois', 'Roux', 'Garcia', 'Morel', 'Laurent'][i % 8]}`;
    const position =
      j === 0 || j === 11
        ? 'Gardien'
        : j < 5 || j === 12
          ? 'Défenseur'
          : j < 8 || j === 13
            ? 'Milieu'
            : 'Attaquant';
    return {
      id: `${team.id}-p${j}`,
      slug: `${slugify(name)}-${team.id}-${j}`,
      name,
      teamId: team.id,
      position,
      number: j === 10 ? 10 : j + 1,
      nationality: team.country,
      birthDate: `${1997 + (j % 8)}-05-15`,
      stats: {
        appearances: 10,
        starts: j < 11 ? 9 : 2,
        minutes: j < 11 ? 720 + j * 9 : 140,
        goals: position === 'Attaquant' ? 4 + ((i + j) % 7) : position === 'Gardien' ? 0 : j % 3,
        assists: position === 'Gardien' ? 0 : 1 + (j % 5),
        rating: 6.6 + ((i + j) % 15) / 10,
        shots: position === 'Gardien' ? 0 : 8 + j * 3,
        shotsOnTarget: position === 'Gardien' ? 0 : 4 + j,
        keyPasses: j * 2,
        tackles: 8 + j,
        interceptions: 5 + j,
        saves: position === 'Gardien' ? 28 + i : null,
        conceded: position === 'Gardien' ? 9 : null,
        cleanSheets: 4,
        yellow: j % 4,
        red: 0,
        passes: 200 + j * 20,
        duels: 20 + j * 3,
        dribbles: j * 2,
      },
    };
  }),
);

export function createDemoDataset(now = new Date()): Dataset {
  const today = dateKey(now);
  const base = new Date(`${today}T12:00:00Z`);
  const matches: Match[] = [];
  const makeMatch = (
    home: Team,
    away: Team,
    day: number,
    index: number,
    history = false,
  ): Match => {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() + day);
    date.setUTCHours(history ? 12 : 17 + (index % 4), index % 2 ? 45 : 0, 0, 0);
    const status =
      history || day < 0
        ? 'finished'
        : day > 0
          ? 'scheduled'
          : index < 2
            ? 'live'
            : index === 5
              ? 'finished'
              : 'scheduled';
    const homeScore =
      status === 'scheduled'
        ? null
        : history
          ? (index * 7 + Math.abs(day)) % 4
          : index === 0
            ? 2
            : 1;
    const awayScore =
      status === 'scheduled'
        ? null
        : history
          ? (index * 3 + Math.abs(day) + 1) % 3
          : index === 0
            ? 1
            : 0;
    const id = history ? `history-${day}-${index}` : `demo-${day}-${index}`;
    const active = status !== 'scheduled';
    const lineup = (team: Team) => ({
      teamId: team.id,
      formation: '4-3-3',
      coach: team.coach,
      confirmed: active,
      starters: players
        .filter((p) => p.teamId === team.id)
        .slice(0, 11)
        .map((p, n) => ({
          id: p.id,
          name: p.name,
          number: p.number,
          row: n === 0 ? 1 : n < 5 ? 2 : n < 8 ? 3 : 4,
          column: n === 0 ? 1 : n < 5 ? n : n < 8 ? n - 4 : n - 7,
        })),
      substitutes: players
        .filter((p) => p.teamId === team.id)
        .slice(11)
        .map((p) => ({ id: p.id, name: p.name, number: p.number })),
    });
    const events: Match['events'] = [];
    for (let n = 0; n < (homeScore ?? 0); n++)
      events.push({
        minute: 12 + n * 20,
        teamId: home.id,
        type: 'goal',
        player: players.find((p) => p.teamId === home.id && p.number === 10)!.name,
        assist: players.find((p) => p.teamId === home.id && p.number === 7)!.name,
      });
    for (let n = 0; n < (awayScore ?? 0); n++)
      events.push({
        minute: 28 + n * 14,
        teamId: away.id,
        type: 'goal',
        player: players.find((p) => p.teamId === away.id && p.number === 10)!.name,
      });
    if (active)
      events.push({
        minute: 34,
        teamId: away.id,
        type: 'yellow',
        player: players.find((p) => p.teamId === away.id && p.number === 4)!.name,
      });
    return {
      id,
      slug: `${home.slug}-${away.slug}-${id}`,
      homeId: home.id,
      awayId: away.id,
      competitionId: home.competitionId,
      kickoff: date.toISOString(),
      status,
      homeScore,
      awayScore,
      minute: status === 'live' ? 67 - index * 29 : null,
      round: history ? `Journée ${Math.abs(day)}` : 'Journée 11',
      venue: home.venue,
      referee: 'Alexandre Dupont (fictif)',
      events: events.sort((a, b) => a.minute - b.minute),
      lineups: history ? [] : [lineup(home), lineup(away)],
      performances:
        !history && active
          ? players
              .filter(
                (p) =>
                  [home.id, away.id].includes(p.teamId) &&
                  players.filter((x) => x.teamId === p.teamId).indexOf(p) < 11,
              )
              .map((p) => ({
                playerId: p.id,
                name: p.name,
                teamId: p.teamId,
                position: p.position,
                number: p.number,
                stats: {
                  appearances: 1,
                  starts: 1,
                  minutes: status === 'finished' ? 90 : 67 - index * 29,
                  goals: events.filter(
                    (e) => e.type === 'goal' && e.teamId === p.teamId && e.player === p.name,
                  ).length,
                  assists: events.filter(
                    (e) => e.type === 'goal' && e.teamId === p.teamId && e.assist === p.name,
                  ).length,
                  rating: p.number === 10 ? 8.1 : 6.8,
                  shots: p.position === 'Attaquant' ? 3 : 0,
                  shotsOnTarget: p.position === 'Attaquant' ? 1 : 0,
                  tackles: p.position === 'Défenseur' ? 3 : 1,
                  interceptions: p.position === 'Défenseur' ? 2 : 0,
                  saves: p.position === 'Gardien' ? (p.teamId === home.id ? 2 : 4) : null,
                  conceded:
                    p.position === 'Gardien'
                      ? p.teamId === home.id
                        ? awayScore
                        : homeScore
                      : null,
                },
              }))
          : [],
      statistics: active
        ? [
            { label: 'Possession', home: 58, away: 42, unit: '%' },
            { label: 'Tirs', home: 14, away: 8 },
            { label: 'Tirs cadrés', home: 6, away: 3 },
            { label: 'Corners', home: 5, away: 3 },
            { label: 'Passes', home: 412, away: 305 },
            { label: 'Précision des passes', home: 89, away: 83, unit: '%' },
            { label: 'Fautes', home: 8, away: 11 },
            { label: 'Cartons jaunes', home: 0, away: 1 },
            { label: 'Hors-jeu', home: 2, away: 1 },
            { label: 'Arrêts', home: 2, away: 4 },
            { label: 'xG', home: null, away: null },
          ]
        : [],
      updatedAt: now.toISOString(),
      source: 'demo',
    };
  };
  // A deterministic fictitious fixture corpus. Never used as real model performance.
  for (let round = 1; round <= 32; round++) {
    for (let i = 0; i < teams.length; i += 2) {
      const flip = round % 2 === 0;
      matches.push(
        makeMatch(teams[i + (flip ? 1 : 0)], teams[i + (flip ? 0 : 1)], -round * 4, i, true),
      );
    }
  }
  for (const day of [-1, 0, 1, 2])
    for (let i = 0; i < teams.length; i += 2)
      matches.push(makeMatch(teams[i], teams[i + 1], day, i / 2));
  const standings: Dataset['standings'] = {};
  for (const comp of competitions) {
    standings[comp.id] = teams
      .filter((t) => t.competitionId === comp.id)
      .map((t) => {
        const played = matches
          .filter(
            (m) =>
              m.competitionId === comp.id &&
              m.status === 'finished' &&
              (m.homeId === t.id || m.awayId === t.id),
          )
          .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
        const results = played.map((m) => {
          const home = m.homeId === t.id;
          return {
            scored: (home ? m.homeScore : m.awayScore)!,
            conceded: (home ? m.awayScore : m.homeScore)!,
          };
        });
        const won = results.filter((r) => r.scored > r.conceded).length,
          drawn = results.filter((r) => r.scored === r.conceded).length;
        return {
          teamId: t.id,
          position: 0,
          played: results.length,
          won,
          drawn,
          lost: results.length - won - drawn,
          scored: results.reduce((s, r) => s + r.scored, 0),
          conceded: results.reduce((s, r) => s + r.conceded, 0),
          points: won * 3 + drawn,
          form: results
            .slice(0, 5)
            .map((r) => (r.scored > r.conceded ? 'V' : r.scored === r.conceded ? 'N' : 'D')),
        };
      })
      .sort((a, b) => b.points - a.points || b.scored - b.conceded - (a.scored - a.conceded))
      .map((r, i) => ({ ...r, position: i + 1 }));
  }
  return {
    source: 'demo',
    updatedAt: now.toISOString(),
    competitions,
    teams,
    players,
    matches,
    standings,
    injuries: [
      {
        id: 'i1',
        playerId: 't1-p12',
        teamId: 't1',
        reason: 'Gêne musculaire (scénario fictif)',
        status: 'Incertain',
      },
    ],
  };
}

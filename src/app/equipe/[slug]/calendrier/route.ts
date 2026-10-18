import { getDataset } from '@/services/football';
import { calendarFile, matchCalendarEvent } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getDataset();
  const team = data.teams.find((row) => row.slug === slug);
  if (!team) return new Response('Équipe introuvable', { status: 404 });
  const now = Date.parse(data.updatedAt) || Date.now();
  const matches = data.matches
    .filter(
      (match) =>
        match.status === 'scheduled' &&
        [match.homeId, match.awayId].includes(team.id) &&
        Date.parse(match.kickoff) >= now,
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const teams = new Map(data.teams.map((row) => [row.id, row]));
  const competitions = new Map(data.competitions.map((row) => [row.id, row]));
  const events = matches.flatMap((match) => {
    const home = teams.get(match.homeId);
    const away = teams.get(match.awayId);
    return home && away
      ? [matchCalendarEvent(match, home, away, competitions.get(match.competitionId))]
      : [];
  });
  return new Response(calendarFile(`Calendrier futur — ${team.name}`, events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${team.slug}-calendrier.ics"`,
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}

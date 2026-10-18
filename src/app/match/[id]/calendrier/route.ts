import { getDataset } from '@/services/football';
import { calendarFile, matchCalendarEvent } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDataset();
  const match = data.matches.find((row) => row.slug === id || row.id === id);
  if (!match) return new Response('Rencontre introuvable', { status: 404 });
  const home = data.teams.find((team) => team.id === match.homeId);
  const away = data.teams.find((team) => team.id === match.awayId);
  if (!home || !away) return new Response('Équipes introuvables', { status: 404 });
  const competition = data.competitions.find((item) => item.id === match.competitionId);
  return new Response(
    calendarFile(`${home.name} – ${away.name}`, [
      matchCalendarEvent(match, home, away, competition),
    ]),
    {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${match.slug}.ics"`,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    },
  );
}

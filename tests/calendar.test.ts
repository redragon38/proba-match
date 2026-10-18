import { describe, expect, it } from 'vitest';
import { calendarFile, matchCalendarEvent } from '@/lib/calendar';
import { createDemoDataset } from '@/services/football/providers/mock';

describe('exports calendrier', () => {
  it('produit un événement UTC stable et correctement échappé', () => {
    const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
    const match = data.matches[0];
    const home = data.teams.find((team) => team.id === match.homeId)!;
    const away = data.teams.find((team) => team.id === match.awayId)!;
    const event = matchCalendarEvent(match, home, away, data.competitions[0]);
    const file = calendarFile('Test, calendrier', [event]);
    expect(file).toContain(`UID:match-${match.id}@proba-match.com`);
    expect(file).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(file).toContain('X-WR-CALNAME:Test\\, calendrier');
    expect(file).toContain(`/match/${match.slug}`);
  });
});

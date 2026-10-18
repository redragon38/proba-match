import type { Competition, Match, Team } from '@/types/football';
import { absoluteUrl } from '@/lib/seo';

const escapeIcs = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const utc = (value: string | Date) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

export function matchCalendarEvent(
  match: Match,
  home: Team,
  away: Team,
  competition?: Competition,
) {
  const start = new Date(match.kickoff);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const url = absoluteUrl(`/match/${match.slug}`);
  return [
    'BEGIN:VEVENT',
    `UID:match-${escapeIcs(match.id)}@proba-match.com`,
    `DTSTAMP:${utc(match.updatedAt)}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${escapeIcs(`${home.name} – ${away.name}`)}`,
    `DESCRIPTION:${escapeIcs(`${competition?.name ?? 'Football'} — fiche Proba Match : ${url}`)}`,
    `URL:${url}`,
    `LOCATION:${escapeIcs(match.venue ?? '')}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
  ].join('\r\n');
}

export function calendarFile(name: string, events: string[]) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Proba Match//Calendrier football//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(name)}`,
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

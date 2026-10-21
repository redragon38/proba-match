import { dateKey } from '@/lib/format';

/** Move calendar days in the chosen zone, not 24-hour instants across a DST change. */
export function calendarDateOffset(now: Date, offset: number, zone = 'Europe/Paris') {
  const day = new Date(`${dateKey(now, zone)}T12:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function validCalendarDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function calendarTimeZone(value: unknown) {
  if (typeof value !== 'string') return 'Europe/Paris';
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value }).format(0);
    return value;
  } catch {
    return 'Europe/Paris';
  }
}

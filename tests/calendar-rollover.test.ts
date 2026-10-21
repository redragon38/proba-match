import { describe, expect, it } from 'vitest';
import { calendarTimeZone, validCalendarDate } from '@/lib/calendar-date';
import { dateKey } from '@/lib/format';

describe('calendar input and day rollover', () => {
  it('rejects impossible dates without rejecting a real day in another timezone', () => {
    expect(validCalendarDate('2026-02-30')).toBe(false);
    expect(validCalendarDate('2028-02-29')).toBe(true);
    expect(validCalendarDate(['2026-10-21'])).toBe(false);
    for (const zone of ['Europe/Paris', 'America/New_York', 'Asia/Tokyo']) {
      expect(calendarTimeZone(zone)).toBe(zone);
      expect(validCalendarDate('2026-10-21')).toBe(true);
    }
    expect(calendarTimeZone('invalid')).toBe('Europe/Paris');
  });
  it.each([
    ['2026-10-21T21:59:59Z', '2026-10-21'],
    ['2026-10-21T22:00:00Z', '2026-10-22'],
    ['2026-03-29T00:59:59Z', '2026-03-29'],
    ['2026-03-29T01:00:00Z', '2026-03-29'],
    ['2026-10-25T00:59:59Z', '2026-10-25'],
    ['2026-10-25T01:00:00Z', '2026-10-25'],
  ])('classifies the Paris day at %s', (iso, expected) => {
    expect(dateKey(new Date(iso), 'Europe/Paris')).toBe(expected);
  });
});

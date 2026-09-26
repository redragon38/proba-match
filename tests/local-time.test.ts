import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocalTime } from '@/components/local-time';
describe('date-only fixtures', () => {
  it('preserves the source calendar date instead of converting a placeholder kickoff', () => {
    const html = renderToStaticMarkup(
      React.createElement(LocalTime, {
        iso: '2026-09-25T23:00:00Z',
        sourceDate: '2026-09-26',
        known: false,
        date: true,
      }),
    );
    expect(html).toContain('dateTime="2026-09-26"');
    expect(html).toContain('26 septembre 2026');
  });
  it('does not invent a kickoff time', () => {
    expect(
      renderToStaticMarkup(
        React.createElement(LocalTime, { iso: '2026-09-26T00:00:00Z', known: false }),
      ),
    ).toContain('Heure à confirmer');
  });
});

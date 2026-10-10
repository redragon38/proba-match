import { describe, expect, it } from 'vitest';
import { metricsFromStatsbombEvents } from '@/services/football/providers/statsbomb';

describe('StatsBomb advanced event metrics', () => {
  it('computes PPDA, field tilt and xT from provider events', () => {
    const event = (
      type: string,
      team: number,
      location: number[],
      extra: Record<string, unknown> = {},
    ) => ({ type: { name: type }, team: { id: team, name: String(team) }, location, ...extra });
    const metrics = metricsFromStatsbombEvents(
      [
        event('Pass', 1, [10, 40], { pass: { end_location: [90, 40] } }),
        event('Carry', 1, [20, 40], { carry: { end_location: [100, 40] } }),
        event('Pass', 2, [20, 30], { pass: { end_location: [85, 30] } }),
        event('Pressure', 1, [90, 40]),
        event('Interception', 2, [80, 40]),
      ],
      1,
      2,
    );
    expect(metrics.find((row) => row.label === 'PPDA')).toMatchObject({ home: 1, away: 1 });
    expect(metrics.find((row) => row.label === 'Field tilt')).toMatchObject({
      home: 50,
      away: 50,
      unit: '%',
    });
    const xt = metrics.find((row) => row.label === 'xT');
    expect(xt?.home).toBeGreaterThan(0);
    expect(xt?.away).toBeGreaterThan(0);
  });

  it('does not turn a missing PPDA denominator into zero', () => {
    const metrics = metricsFromStatsbombEvents(
      [
        {
          type: { name: 'Pass' },
          team: { id: 1, name: 'Home' },
          location: [10, 40],
          pass: { end_location: [90, 40] },
        },
      ],
      1,
      2,
    );
    expect(metrics.find((row) => row.label === 'PPDA')).toBeUndefined();
  });
});

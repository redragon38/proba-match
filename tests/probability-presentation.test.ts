import { describe, expect, it } from 'vitest';
import {
  formatProbability,
  probabilityPercentages,
  probabilityReading,
} from '@/lib/probability-format';

describe('lecture des probabilités sans modifier le modèle', () => {
  it.each([
    { values: [0.75, 0.15, 0.1], leader: 0, label: 'Avantage marqué', emphasize: true },
    { values: [0.35, 0.32, 0.33], leader: 0, label: 'Très équilibré', emphasize: false },
    { values: [0.25, 0.5, 0.25], leader: 1, label: 'Avantage marqué', emphasize: true },
    { values: [0.43, 0.29, 0.28], leader: 0, label: 'Léger avantage', emphasize: true },
  ])(
    'classe $values selon l’écart réel des deux premières issues',
    ({ values, leader, label, emphasize }) => {
      const original = [...values];
      const reading = probabilityReading(values[0], values[1], values[2]);
      expect(reading).toMatchObject({ leader, label, emphasize });
      expect(values).toEqual(original);
      expect(
        probabilityPercentages(values[0], values[1], values[2]).reduce(
          (sum, value) => sum + value,
          0,
        ),
      ).toBe(100);
    },
  );

  it('distingue une probabilité nulle d’une donnée absente', () => {
    expect(formatProbability(0)).toBe('0 %');
    expect(formatProbability(null)).toBe('Non disponible');
    expect(formatProbability(NaN)).toBe('Non disponible');
    expect(formatProbability(1.2)).toBe('Non disponible');
    expect(probabilityReading(1.2, 0.1, 0.1)).toBeNull();
    expect(probabilityReading(NaN, 0.5, 0.5)).toBeNull();
  });
});

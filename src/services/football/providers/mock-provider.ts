import type { FootballDataProvider, FixtureBatch } from '../provider';
import { createDemoDataset } from './mock';
import { dateKey } from '@/lib/format';
export class MockFootballProvider implements FootballDataProvider {
  readonly name = 'demo';
  private data = createDemoDataset();
  async fixtures(date: string): Promise<FixtureBatch> {
    return {
      ...this.data,
      matches: this.data.matches.filter((m) => dateKey(new Date(m.kickoff)) === date),
    };
  }
  async details(ids: string[]): Promise<FixtureBatch> {
    return { ...this.data, matches: this.data.matches.filter((m) => ids.includes(m.id)) };
  }
  async standings(id: string) {
    return this.data.standings[id] ?? [];
  }
  async players(id: string) {
    return this.data.players.filter((p) => p.teamId === id);
  }
}

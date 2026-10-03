import { describe, expect, it, vi } from 'vitest';
import { bootstrapExpandedProduction } from '../src/services/football/production-bootstrap';

const production = { production: true, databaseConfigured: true };
function dependencies(states: { seasons: boolean; rosters: boolean }[]) {
  let cursor = 0;
  return {
    state: vi.fn(async () => states[Math.min(cursor++, states.length - 1)]),
    seasons: vi.fn(async () => ({ status: 'success', failures: 0 })),
    players: vi.fn(async () => ({ status: 'success', failures: 0 })),
    wait: vi.fn(async () => undefined),
  };
}
describe('production data initialization', () => {
  it('never connects to a database or imports data for previews and local builds', async () => {
    const deps = dependencies([{ seasons: false, rosters: false }]);
    expect(
      await bootstrapExpandedProduction({ production: false, databaseConfigured: false }, deps),
    ).toBe('skipped');
    expect(deps.state).not.toHaveBeenCalled();
    expect(deps.seasons).not.toHaveBeenCalled();
  });
  it('requires the production database', async () => {
    const deps = dependencies([{ seasons: false, rosters: false }]);
    await expect(
      bootstrapExpandedProduction({ ...production, databaseConfigured: false }, deps),
    ).rejects.toThrow('PRODUCTION_DATABASE_NOT_CONFIGURED');
    expect(deps.state).not.toHaveBeenCalled();
  });
  it('does not refresh an already initialized production corpus', async () => {
    const deps = dependencies([{ seasons: true, rosters: true }]);
    expect(await bootstrapExpandedProduction(production, deps)).toBe('ready');
    expect(deps.seasons).not.toHaveBeenCalled();
    expect(deps.players).not.toHaveBeenCalled();
  });
  it('imports missing history and all remaining roster batches before declaring success', async () => {
    const deps = dependencies([
      { seasons: false, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: true },
    ]);
    expect(await bootstrapExpandedProduction(production, deps)).toBe('initialized');
    expect(deps.seasons).toHaveBeenCalledTimes(1);
    expect(deps.players).toHaveBeenCalledTimes(2);
  });
  it('resumes missing rosters without reimporting existing seasons', async () => {
    const deps = dependencies([
      { seasons: true, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: true },
    ]);
    await bootstrapExpandedProduction(production, deps);
    expect(deps.seasons).not.toHaveBeenCalled();
    expect(deps.players).toHaveBeenCalledTimes(1);
  });
  it('fails the deployment when a source import is partial or locked', async () => {
    const deps = dependencies([{ seasons: false, rosters: false }]);
    deps.seasons.mockResolvedValue({ status: 'partial', failures: 1 });
    await expect(bootstrapExpandedProduction(production, deps)).rejects.toThrow(
      'PRODUCTION_LEAGUE_IMPORT_INCOMPLETE',
    );
    expect(deps.players).not.toHaveBeenCalled();
    expect(deps.seasons).toHaveBeenCalledTimes(3);
  });
  it('does not claim success when roster imports fail', async () => {
    const deps = dependencies([{ seasons: true, rosters: false }]);
    deps.players.mockResolvedValue({ status: 'partial', failures: 1 });
    await expect(bootstrapExpandedProduction(production, deps)).rejects.toThrow(
      'PRODUCTION_PLAYER_IMPORT_INCOMPLETE',
    );
  });
  it('bounds retries when successful responses do not persist complete data', async () => {
    const deps = dependencies([{ seasons: true, rosters: false }]);
    await expect(bootstrapExpandedProduction(production, deps)).rejects.toThrow(
      'PRODUCTION_BOOTSTRAP_INCOMPLETE',
    );
    expect(deps.players).toHaveBeenCalledTimes(8);
  });
  it('continues after a partial roster batch and verifies persisted completion', async () => {
    const deps = dependencies([
      { seasons: true, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: true },
    ]);
    deps.players.mockResolvedValueOnce({ status: 'partial', failures: 1 });
    expect(await bootstrapExpandedProduction(production, deps)).toBe('initialized');
    expect(deps.players).toHaveBeenCalledTimes(2);
    expect(deps.wait).toHaveBeenCalledTimes(1);
  });
  it('retries a failed write without declaring the data ready', async () => {
    const deps = dependencies([
      { seasons: true, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: false },
      { seasons: true, rosters: true },
    ]);
    deps.players.mockRejectedValueOnce(new Error('SYNC_FAILED'));
    expect(await bootstrapExpandedProduction(production, deps)).toBe('initialized');
    expect(deps.players).toHaveBeenCalledTimes(2);
    expect(deps.wait).toHaveBeenCalledTimes(1);
  });
});

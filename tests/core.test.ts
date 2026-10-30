/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { nextRandom, run, step } from '../src/sim';
import { crowd, daySim, tuning } from './helpers';

function scenario(seed: number) {
  const sim = daySim(seed);
  crowd(sim, { size: 8000, origin: 'N1', destination: 'N9' });
  crowd(sim, { size: 3000, origin: 'N9', destination: 'N13' });
  crowd(sim, { size: 4000, origin: 'N1', destination: 'N2', energy: 75 });
  run(sim, tuning.phaseLength);
  return sim.state;
}

describe('fixed tick and determinism (architecture)', () => {
  it('one step is one second; the phase stops at t = 240', () => {
    const sim = daySim();
    step(sim);
    expect(sim.state.t).toBe(1);
    run(sim, 1000);
    expect(sim.state.t).toBe(240);
  });

  it('same seed and inputs give the same result', () => {
    expect(JSON.stringify(scenario(42))).toBe(JSON.stringify(scenario(42)));
  });

  it('the generator is seeded', () => {
    const a = { rngState: 7 };
    const b = { rngState: 7 };
    const c = { rngState: 8 };
    const seqA = [1, 2, 3].map(() => nextRandom(a));
    expect([1, 2, 3].map(() => nextRandom(b))).toEqual(seqA);
    expect([1, 2, 3].map(() => nextRandom(c))).not.toEqual(seqA);
  });
});

describe('Day 5 start state (build spec §1)', () => {
  it('F 35, C 50, pools, recruits, troops and phantoms come from tuning', () => {
    const s = daySim().state;
    expect(s.F).toBe(35);
    expect(s.C).toBe(50);
    expect(s.pools).toEqual({ N1: 11550, N9: 4950 });
    expect(s.crowds).toHaveLength(1);
    expect(s.crowds[0]).toMatchObject({ owner: 'N', recruit: true, size: 2000, energy: 60, fear: 10, pos: { kind: 'node', node: 'N2' } });
    expect(s.troops.map((u) => [u.id, u.node, u.posture])).toEqual([
      ['T-VW', 'N12', 'Guard'],
      ['T-CH', 'N6', 'Guard'],
      ['T-RG', 'N3', 'Barracked'],
      ['T-PI', 'N14', 'Barracked'],
    ]);
    expect(s.phantoms.map((p) => p.node)).toEqual(['N3', 'N13']);
  });
});

describe('no hardcoded tuning numbers in sim logic', () => {
  const sources = import.meta.glob<string>('../src/sim/*.ts', { query: '?raw', import: 'default', eager: true });
  const exempt = ['rng.ts', 'units.ts']; // PRNG constants and unit conversions
  for (const [path, source] of Object.entries(sources)) {
    const file = path.split('/').pop()!;
    if (exempt.includes(file)) continue;
    it(file, () => {
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'[^']*'|`[^`]*`/g, "''");
      const literals = code.match(/(?<![\w.])\d+(\.\d+)?(?![\w.])/g) ?? [];
      expect(literals.filter((n: string) => n !== '0' && n !== '1')).toEqual([]);
    });
  }
});

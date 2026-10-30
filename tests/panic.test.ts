import { describe, expect, it } from 'vitest';
import { run, step, type Sim } from '../src/sim';
import { emptySim, guard, standing } from './helpers';

function runUntil(sim: Sim, pred: () => boolean, max = 240) {
  for (let i = 0; i < max && !pred(); i++) step(sim);
}

describe('panic (spec §4.12)', () => {
  it('at fear ≥ 80: Panicking, heads for its origin', () => {
    const sim = emptySim();
    const c = standing(sim, 'N4', { origin: 'N1', fear: 81 });
    step(sim);
    expect(c.state).toBe('Panicking');
    expect(c.destination).toBe('N1');
    expect(c.fleeing).toBe(true);
    expect(sim.state.events.find((e) => e.kind === 'panic')).toMatchObject({ crowd: c.id });
  });

  it('does not panic below 80', () => {
    const sim = emptySim();
    const c = standing(sim, 'N4', { origin: 'N1', fear: 79.9 });
    step(sim);
    expect(c.state).toBe('Rallying');
  });

  it('flees ignoring cordons', () => {
    const sim = emptySim();
    guard(sim, 'N8');
    const c = standing(sim, 'N4', { origin: 'N9', fear: 90 });
    step(sim);
    expect(c.path).toEqual(['N8', 'N9']);
    runUntil(sim, () => c.removed);
    expect(sim.state.events.some((e) => e.kind === 'cordoned')).toBe(false);
    expect(sim.state.events.find((e) => e.kind === 'home')).toMatchObject({ crowd: c.id, node: 'N9' });
  });

  it('moves at speed × 1.5 and loses 8% size per 10 s', () => {
    const sim = emptySim();
    const c = standing(sim, 'N4', { size: 5000, origin: 'N9', fear: 90 });
    step(sim); // panics this tick (movement already ran)
    expect(c.size).toBeCloseTo(5000 * (1 - 0.008), 6);
    step(sim);
    // N4–N8 boulevard, 2 blocks; normal speed 0.1 × (1 − size/30,000)
    expect(c.pos.kind).toBe('edge');
    const normal = 0.1 * (1 - (5000 * 0.992) / 30000);
    expect(c.pos.kind === 'edge' && c.pos.progress).toBeCloseTo((normal * 1.5) / 2, 6);
  });

  it('after 30 s: Shaken, fear set to 50, energy capped at 50 for 60 s, still heading home', () => {
    const sim = emptySim();
    const c = standing(sim, 'N1', { size: 5000, origin: 'N15', fear: 90, energy: 90 });
    run(sim, 29);
    expect(c.state).toBe('Panicking');
    step(sim);
    expect(c.state).toBe('Shaken');
    expect(c.fear).toBe(50);
    expect(c.energy).toBeLessThanOrEqual(50);
    c.speaker = 'Liebknecht';
    run(sim, 30);
    expect(c.energy).toBeLessThanOrEqual(50);
    expect(c.destination).toBe('N15');
  });

  it('a Shaken crowd can panic again at fear ≥ 80 (§12 N7)', () => {
    const sim = emptySim();
    const c = standing(sim, 'N1', { size: 5000, origin: 'N15', fear: 90 });
    run(sim, 31);
    expect(c.state).toBe('Shaken');
    c.fear = 85;
    step(sim);
    expect(c.state).toBe('Panicking');
  });

  it('on reaching origin: 50% back to the pool, rest gone', () => {
    const sim = emptySim();
    const pool = sim.state.pools.N9;
    const c = standing(sim, 'N9', { size: 4000, origin: 'N9', fear: 85 });
    step(sim);
    expect(c.removed).toBe(true);
    expect(sim.state.pools.N9).toBe(pool + 2000);
    expect(sim.state.crowds).toHaveLength(0);
  });
});

describe('dispersal (spec §4.12)', () => {
  it('energy 0: removed', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { energy: 0.1 });
    step(sim);
    expect(c.removed).toBe(true);
    expect(sim.state.events.find((e) => e.kind === 'dispersed')).toMatchObject({ cause: 'energy', remnantTo: null });
  });

  it('size < 150: removed', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { size: 149 });
    step(sim);
    expect(c.removed).toBe(true);
    expect(sim.state.events.find((e) => e.kind === 'dispersed')).toMatchObject({ cause: 'size' });
  });

  it('remnant merges into a friendly crowd at the node', () => {
    const sim = emptySim();
    const big = standing(sim, 'N9', { size: 5000 });
    const small = standing(sim, 'N9', { size: 140 });
    small.destination = 'N8'; // different destination, so no ordinary merge
    step(sim);
    expect(small.removed).toBe(true);
    expect(big.size).toBeCloseTo(5140, 6);
    expect(sim.state.events.find((e) => e.kind === 'dispersed')).toMatchObject({ remnantTo: big.id });
  });
});

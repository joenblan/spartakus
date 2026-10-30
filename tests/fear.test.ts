import { describe, expect, it } from 'vitest';
import { applyVolleyNoise, applyWarningShots, fearRates, spreadFear, step } from '../src/sim';
import { daySim, emptySim, guard, standing } from './helpers';

describe('crowd fear rates (spec §4.5)', () => {
  it('recovery −10/min only when no threat is in range', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { fear: 30 });
    expect(fearRates(sim, c)).toEqual({ recovery: -10 });
    step(sim);
    expect(c.fear).toBeCloseTo(30 - 10 / 60, 6);
  });

  it('phantom within 1 node: +5/min and no recovery', () => {
    const sim = emptySim();
    sim.state.phantoms.push({ id: 'P', node: 'N3', label: 'x', reported: 500 });
    expect(fearRates(sim, standing(sim, 'N3'))).toEqual({ phantom: 5 });
    expect(fearRates(sim, standing(sim, 'N4'))).toEqual({ phantom: 5 });
    expect(fearRates(sim, standing(sim, 'N1'))).toEqual({ recovery: -10 });
  });

  it('phantom on an edge is measured from either end', () => {
    const sim = emptySim();
    sim.state.phantoms.push({ id: 'P', node: 'N3', label: 'x', reported: 500 });
    const c = standing(sim, 'N5');
    c.pos = { kind: 'edge', edge: 'E3', from: 'N5', to: 'N4', progress: 0.2 };
    expect(fearRates(sim, c).phantom).toBe(5);
  });

  it('adjacent to a Hardened G unit: +5/min and no recovery; Wavering units do not count', () => {
    const sim = emptySim();
    guard(sim, 'N6', 'Hardened');
    guard(sim, 'N12', 'Wavering');
    expect(fearRates(sim, standing(sim, 'N4'))).toEqual({ adjHardened: 5 });
    expect(fearRates(sim, standing(sim, 'N11'))).toEqual({ recovery: -10 });
  });

  it('acceptance 3: a crowd at N4 on Day 5 gets +5/min from the N3 phantom and no recovery', () => {
    const sim = daySim();
    const c = standing(sim, 'N4');
    const r = fearRates(sim, c);
    expect(r.phantom).toBe(5);
    expect(r.recovery).toBeUndefined();
  });

  it('speaker attached: − calm/min', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { fear: 40 });
    c.speaker = 'Liebknecht';
    expect(fearRates(sim, c).speaker).toBe(-12);
    c.speaker = 'Daeumig';
    expect(fearRates(sim, c).speaker).toBe(-18);
  });

  it('escorted crowd: all fear gains × 0.5; losses unchanged', () => {
    const sim = emptySim();
    sim.state.phantoms.push({ id: 'P', node: 'N3', label: 'x', reported: 500 });
    const a = standing(sim, 'N4', { fear: 20 });
    const b = standing(sim, 'N9', { fear: 20 });
    a.escort = 'A1';
    b.escort = 'A2';
    a.destination = 'N3';
    step(sim);
    expect(a.fear).toBeCloseTo(20 + (5 / 60) * 0.5, 6);
    expect(b.fear).toBeCloseTo(20 - 10 / 60, 6);
  });
});

describe('volley and warning-shot noise (spec §4.5)', () => {
  it('volley: +35 same node, +20 within 1 node, +8 within 2 nodes', () => {
    const sim = emptySim();
    const same = standing(sim, 'N4', { fear: 10 });
    const one = standing(sim, 'N5', { fear: 10 });
    const two = standing(sim, 'N1', { fear: 10 });
    const far = standing(sim, 'N10', { fear: 10 });
    applyVolleyNoise(sim, 'N4', 0, 'L');
    expect([same.fear, one.fear, two.fear, far.fear]).toEqual([45, 30, 18, 10]);
  });

  it('cordoned crowd pressing the node counts as at it', () => {
    const sim = emptySim();
    const c = standing(sim, 'N4', { fear: 10 });
    c.cordonedAt = 'N6';
    applyVolleyNoise(sim, 'N6', 0, 'L');
    expect(c.fear).toBe(45);
  });

  it('escorted crowd takes half', () => {
    const sim = emptySim();
    const c = standing(sim, 'N4', { fear: 10 });
    c.escort = 'A1';
    applyVolleyNoise(sim, 'N4', 0, 'L');
    expect(c.fear).toBe(27.5);
  });

  it('own-side deaths within 1 node: +5 energy once per incident', () => {
    const sim = emptySim();
    const near = standing(sim, 'N5', { energy: 50 });
    const far = standing(sim, 'N1', { energy: 50 });
    applyVolleyNoise(sim, 'N4', 3, 'L');
    expect(near.energy).toBe(55);
    expect(far.energy).toBe(50);
  });

  it('city fear F: +2 per volley, +1 per death, deaths capped at +10 per phase', () => {
    const sim = emptySim();
    const f0 = sim.state.F;
    applyVolleyNoise(sim, 'N4', 3, 'L');
    expect(sim.state.F).toBe(f0 + 5);
    applyVolleyNoise(sim, 'N4', 9, 'L');
    expect(sim.state.F).toBe(f0 + 5 + 2 + 7);
    applyVolleyNoise(sim, 'N4', 4, 'L');
    expect(sim.state.F).toBe(f0 + 5 + 9 + 2);
  });

  it('a volley in the last 10 s blocks recovery', () => {
    const sim = emptySim();
    const c = standing(sim, 'N1', { fear: 30 });
    applyVolleyNoise(sim, 'N4', 0, 'G');
    expect(fearRates(sim, c).recovery).toBeUndefined();
    sim.state.t += 10;
    expect(fearRates(sim, c).recovery).toBe(-10);
  });

  it('warning shots: +15 at the node only', () => {
    const sim = emptySim();
    const at = standing(sim, 'N12', { fear: 10 });
    const adj = standing(sim, 'N11', { fear: 10 });
    applyWarningShots(sim, 'N12');
    expect(at.fear).toBe(25);
    expect(adj.fear).toBe(10);
  });
});

describe('fear spread (spec §4.5)', () => {
  it('moves 25% toward the size-weighted average at its node; only raises', () => {
    const sim = emptySim();
    const low = standing(sim, 'N9', { size: 3000, fear: 20 });
    const high = standing(sim, 'N9', { size: 1000, fear: 36 });
    high.destination = 'N8'; // keep them from merging
    spreadFear(sim);
    expect(low.fear).toBeCloseTo(20 + 0.25 * (24 - 20), 6);
    expect(high.fear).toBe(36);
  });

  it('moves 10% toward the adjacent node average if higher', () => {
    const sim = emptySim();
    const c = standing(sim, 'N8', { fear: 20 });
    standing(sim, 'N9', { fear: 40 });
    standing(sim, 'N10', { fear: 70 });
    spreadFear(sim);
    expect(c.fear).toBeCloseTo(22, 6);
  });

  it('max +5 per 5 s', () => {
    const sim = emptySim();
    const low = standing(sim, 'N9', { size: 1000, fear: 0 });
    const high = standing(sim, 'N9', { size: 1000, fear: 100 });
    high.destination = 'N8';
    spreadFear(sim);
    expect(low.fear).toBe(5);
  });

  it('runs only when t % 5 == 0', () => {
    const sim = emptySim();
    const low = standing(sim, 'N9', { size: 1000, fear: 20 });
    const high = standing(sim, 'N9', { size: 1000, fear: 60 });
    high.destination = 'N8';
    sim.state.t = 1;
    step(sim);
    expect(low.fear).toBeCloseTo(20 - 10 / 60, 6);
    sim.state.t = 5;
    const before = low.fear;
    step(sim);
    expect(low.fear).toBeGreaterThan(before + 4);
  });
});

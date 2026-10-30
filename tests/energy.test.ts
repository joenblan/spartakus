import { describe, expect, it } from 'vitest';
import { energyRates, run, step } from '../src/sim';
import { crowd, daySim, emptySim, standing } from './helpers';

describe('energy rates (spec §4.3)', () => {
  it('base decay −12/min', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { energy: 60 });
    expect(energyRates(sim, c)).toEqual({ decay: -12 });
    step(sim);
    expect(c.energy).toBeCloseTo(59.8, 6);
  });

  it('waiting while Cordoned: −6/min extra', () => {
    const sim = emptySim();
    const c = standing(sim, 'N4');
    c.cordonedAt = 'N6';
    c.state = 'Cordoned';
    expect(energyRates(sim, c)).toEqual({ decay: -12, waiting: -6 });
  });

  it('fear above 50: −(fear − 50)/5 per min, max −10', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { fear: 50 });
    expect(energyRates(sim, c).fear).toBeUndefined();
    c.fear = 70;
    expect(energyRates(sim, c).fear).toBeCloseTo(-4);
    c.fear = 100;
    expect(energyRates(sim, c).fear).toBe(-10);
  });

  it('speaker attached: + gain/min, ×1.25 at Siegesallee (N2), Eichhorn ×1.5 at N9', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9');
    c.speaker = 'Liebknecht';
    expect(energyRates(sim, c).speaker).toBe(40);
    c.speaker = 'Ledebour';
    expect(energyRates(sim, c).speaker).toBe(30);
    c.speaker = 'Eichhorn';
    expect(energyRates(sim, c).speaker).toBe(45);
    const d = standing(sim, 'N2');
    d.speaker = 'Daeumig';
    expect(energyRates(sim, d).speaker).toBe(37.5);
    d.speaker = 'Eichhorn';
    expect(energyRates(sim, d).speaker).toBe(37.5);
  });

  it('clamped to 0–100', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { energy: 99.9 });
    c.speaker = 'Liebknecht';
    step(sim);
    expect(c.energy).toBe(100);
  });

  it('acceptance 6: unspoken crowd at 60 arriving at t = 60 reads ≈63 then and ≈27 at t = 240 (Drifting)', () => {
    const sim = daySim();
    // 15,000 walks at the 0.05 floor: N1–N5–N4 is 3 blocks = 60 s.
    const c = crowd(sim, { size: 15000, origin: 'N1', destination: 'N4', energy: 60 });
    run(sim, 60);
    expect(c.state).toBe('Rallying');
    expect(c.energy).toBeCloseTo(63, 6);
    run(sim, 180);
    expect(sim.state.t).toBe(240);
    expect(c.energy).toBeCloseTo(27, 6);
    expect(c.state).toBe('Drifting');
  });
});

describe('drifting (spec §4.4)', () => {
  it('energy < 30: −10% size/min, state Drifting', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { size: 6000, energy: 29.5 });
    step(sim);
    expect(c.state).toBe('Drifting');
    expect(c.size).toBeCloseTo(6000 * (1 - 0.1 / 60), 6);
    expect(sim.state.events.some((e) => e.kind === 'drifting')).toBe(true);
  });

  it('energy < 15: −25% size/min', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { size: 6000, energy: 14.5 });
    step(sim);
    expect(c.size).toBeCloseTo(6000 * (1 - 0.25 / 60), 6);
  });

  it('a drifting crowd lifted back to 30 stops drifting', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9', { size: 6000, energy: 29.9 });
    step(sim);
    expect(c.state).toBe('Drifting');
    c.speaker = 'Liebknecht';
    run(sim, 5);
    expect(c.state).toBe('Rallying');
  });
});

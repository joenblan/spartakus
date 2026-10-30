import { describe, expect, it } from 'vitest';
import { buildGraph, crowdPresence, crowdSpeed, pathTravelTime, pressure } from '../src/sim';
import { emptySim, map, standing, tuning } from './helpers';

describe('crowd speed (spec §3.1)', () => {
  it('0.10 × (1 − size/30,000) × min(1, capacity/size)', () => {
    expect(crowdSpeed(tuning, 8000, 8000)).toBeCloseTo(0.0733, 4);
    expect(crowdSpeed(tuning, 10000, 8000)).toBeCloseTo(0.1 * (2 / 3) * 0.8, 6);
  });

  it('floor 0.05 applied last', () => {
    expect(crowdSpeed(tuning, 15000, 5000)).toBe(0.05);
  });

  it('acceptance 1: 8,000 from N1 to N9 via N5–N4–N8 takes ≈109 s', () => {
    const t = pathTravelTime(tuning, buildGraph(map), 8000, ['N1', 'N5', 'N4', 'N8', 'N9']);
    expect(t).toBeCloseTo(109.1, 1);
  });

  it('acceptance 2: 10,000 via N1–N2–N3–N4–N8–N9 takes ≈221 s', () => {
    const t = pathTravelTime(tuning, buildGraph(map), 10000, ['N1', 'N2', 'N3', 'N4', 'N8', 'N9']);
    expect(t).toBeCloseTo(221.25, 1);
  });
});

describe('pressure and presence (spec §3.1)', () => {
  it('P = size × energy/100 × (1 − fear/100), ×1.3 escorted, 0 when Panicking or Shaken', () => {
    const sim = emptySim();
    const c = standing(sim, 'N12', { size: 5000, energy: 80, fear: 17.5 });
    expect(pressure(tuning, c)).toBeCloseTo(3300);
    c.escort = 'A1';
    expect(pressure(tuning, c)).toBeCloseTo(4290);
    c.state = 'Panicking';
    expect(pressure(tuning, c)).toBe(0);
    c.state = 'Shaken';
    expect(pressure(tuning, c)).toBe(0);
  });

  it('presence = size × (0.5 + energy/200); 0 on an edge, Panicking or Forming; 50% when Cordoned', () => {
    const sim = emptySim();
    const c = standing(sim, 'N4', { size: 4000, energy: 60 });
    expect(crowdPresence(tuning, c)).toBeCloseTo(3200);
    c.cordonedAt = 'N6';
    c.state = 'Cordoned';
    expect(crowdPresence(tuning, c)).toBeCloseTo(1600);
    c.cordonedAt = null;
    c.state = 'Marching';
    c.pos = { kind: 'edge', edge: 'E10', from: 'N4', to: 'N6', progress: 0.5 };
    expect(crowdPresence(tuning, c)).toBe(0);
    c.pos = { kind: 'node', node: 'N4' };
    c.state = 'Panicking';
    expect(crowdPresence(tuning, c)).toBe(0);
    c.state = 'Forming';
    expect(crowdPresence(tuning, c)).toBe(0);
  });
});

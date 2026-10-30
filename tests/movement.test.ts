import { describe, expect, it } from 'vitest';
import { arrive, createSim, onCordonIntelChanged, run, step, type Sim } from '../src/sim';
import { crowd, daySim, emptySim, guard, standing, tuning } from './helpers';

function runUntil(sim: Sim, pred: () => boolean, max = 240) {
  for (let i = 0; i < max && !pred(); i++) step(sim);
}

describe('path planning (spec §4.2)', () => {
  it('takes the fastest path: N1 → N9 via N5–N4–N8', () => {
    const sim = daySim();
    const c = crowd(sim, { size: 8000, origin: 'N1', destination: 'N9' });
    expect(c.path).toEqual(['N5', 'N4', 'N8', 'N9']);
  });

  it('excludes intermediate nodes with reported Guard troops, phantoms included (acceptance 3)', () => {
    const sim = daySim();
    // Plain fastest path from N2 to N9 is through N3, where the R3 phantom is reported.
    const c = crowd(sim, { size: 5000, origin: 'N2', destination: 'N9' });
    expect(c.path).not.toContain('N3');
    expect(c.path).toEqual(['N1', 'N5', 'N4', 'N8', 'N9']);
  });

  it('the destination itself may be a reported node', () => {
    const sim = daySim();
    const c = crowd(sim, { size: 5000, origin: 'N4', destination: 'N3' });
    expect(c.path).toEqual(['N3']);
  });

  it('with no clean path, takes the plain fastest path and gets cordoned', () => {
    const sim = daySim();
    // Every route to N13 passes N12 (T-VW, Guard) or N6 (T-CH, Guard).
    const c = crowd(sim, { size: 3000, origin: 'N9', destination: 'N13' });
    expect(c.path.length).toBeGreaterThan(0);
    runUntil(sim, () => c.state === 'Cordoned');
    expect(c.state).toBe('Cordoned');
    expect(['N6', 'N12']).toContain(c.cordonedAt);
  });
});

describe('cordon (spec §4.2)', () => {
  it('stops at the edge end, counted as at that node, and does not arrive', () => {
    const sim = emptySim();
    guard(sim, 'N6');
    const c = crowd(sim, { size: 4000, origin: 'N4', destination: 'N6' });
    run(sim, 30);
    expect(c.state).toBe('Cordoned');
    expect(c.cordonedAt).toBe('N6');
    expect(c.pos).toMatchObject({ kind: 'edge', to: 'N6', progress: 1 });
    expect(c.arrivedOnce).toBe(false);
  });

  it('walks in once the node is no longer held in Guard posture', () => {
    const sim = emptySim();
    guard(sim, 'N6');
    const c = crowd(sim, { size: 4000, origin: 'N4', destination: 'N6' });
    run(sim, 30);
    sim.state.troops[0].posture = 'Stand-aside';
    step(sim);
    expect(c.cordonedAt).toBeNull();
    expect(c.pos).toEqual({ kind: 'node', node: 'N6' });
    expect(c.state).toBe('Rallying');
  });

  it('Barracked troops do not cordon: crowds pass freely', () => {
    const sim = emptySim();
    guard(sim, 'N3', 'Hardened', 'Barracked');
    const c = crowd(sim, { size: 4000, origin: 'N4', destination: 'N3' });
    run(sim, 40);
    expect(c.state).toBe('Rallying');
  });
});

describe('re-route (spec §4.2)', () => {
  // Diamond: A–B–D is short, A–C–D long.
  const diamond = {
    nodes: ['A', 'B', 'C', 'D'].map((id, i) => ({ id, name: id, x: i, y: 0, weight: 1, type: 'test' })),
    edges: [
      { id: 'AB', a: 'A', b: 'B', blocks: 1, kind: 'street' },
      { id: 'BD', a: 'B', b: 'D', blocks: 1, kind: 'street' },
      { id: 'AC', a: 'A', b: 'C', blocks: 2, kind: 'street' },
      { id: 'CD', a: 'C', b: 'D', blocks: 2, kind: 'street' },
    ],
  };
  function diamondSim(fear: number) {
    const sim = createSim(tuning, diamond, 1);
    sim.state.troops = [];
    sim.state.phantoms = [];
    sim.state.crowds = [];
    const c = crowd(sim, { size: 3000, origin: 'A', destination: 'D', fear });
    expect(c.path).toEqual(['B', 'D']);
    step(sim);
    sim.state.phantoms.push({ id: 'PX', node: 'B', label: 'test', reported: 500 });
    onCordonIntelChanged(sim);
    return c;
  }

  it('a crowd with fear ≥ 50 re-plans around a newly reported cordon', () => {
    const c = diamondSim(60);
    expect(c.path).toEqual(['A', 'C', 'D']);
    expect(c.pos).toMatchObject({ kind: 'edge', from: 'B', to: 'A' });
  });

  it('a crowd with fear below 50 presses on', () => {
    const c = diamondSim(40);
    expect(c.path).toEqual(['B', 'D']);
  });
});

describe('arrival (spec §4.2)', () => {
  it('+15 energy once per crowd life on first reaching the destination, then Rallying', () => {
    const sim = emptySim();
    const c = crowd(sim, { size: 3000, origin: 'N1', destination: 'N5', energy: 60 });
    runUntil(sim, () => c.state === 'Rallying');
    const ev = sim.state.events.find((e) => e.kind === 'arrived');
    expect(ev).toMatchObject({ crowd: c.id, node: 'N5', energyBonus: 15 });
    const before = c.energy;
    arrive(sim, c, 'N5');
    expect(c.energy).toBe(before);
  });

  it('acceptance 1 in the running sim: 8,000 from N1 reaches N9 at t ≈ 109', () => {
    const sim = daySim();
    const c = crowd(sim, { size: 8000, origin: 'N1', destination: 'N9' });
    runUntil(sim, () => c.state === 'Rallying');
    const ev = sim.state.events.find((e) => e.kind === 'arrived')!;
    expect(ev.t).toBeGreaterThanOrEqual(108);
    expect(ev.t).toBeLessThanOrEqual(110);
  });
});

describe('merge (spec §4.2)', () => {
  it('two L crowds at one node with the same destination merge; energy and fear size-weighted', () => {
    const sim = emptySim();
    const a = standing(sim, 'N9', { size: 6000, energy: 70, fear: 20 });
    const b = standing(sim, 'N9', { size: 2000, energy: 50, fear: 40 });
    step(sim);
    expect(sim.state.crowds).toHaveLength(1);
    expect(sim.state.crowds[0].id).toBe(a.id);
    expect(a.size).toBe(8000);
    // weighted values, then one tick of rates (decay −0.2, fear recovery −10/60)
    expect(a.energy).toBeCloseTo(65 - 12 / 60, 6);
    expect(a.fear).toBeCloseTo(25 - 10 / 60, 6);
    expect(b.removed).toBe(true);
  });

  it('different destinations do not merge', () => {
    const sim = emptySim();
    standing(sim, 'N9', { size: 6000 });
    const b = standing(sim, 'N9', { size: 2000 });
    b.destination = 'N8';
    b.path = [];
    step(sim);
    expect(sim.state.crowds.filter((c) => !c.removed)).toHaveLength(2);
  });

  it('no merge above the 15,000 blob cap (§12 M4)', () => {
    const sim = emptySim();
    standing(sim, 'N9', { size: 9000 });
    standing(sim, 'N9', { size: 7000 });
    step(sim);
    expect(sim.state.crowds).toHaveLength(2);
  });

  it('the larger crowd keeps its escort; the other escort becomes Free (§4.13)', () => {
    const sim = emptySim();
    const a = standing(sim, 'N9', { size: 6000 });
    const b = standing(sim, 'N9', { size: 2000 });
    a.escort = 'A1';
    b.escort = 'A2';
    sim.state.armed.forEach((u) => (u.stance = 'Escorting'));
    step(sim);
    expect(a.escort).toBe('A1');
    expect(sim.state.armed.find((u) => u.id === 'A2')!.stance).toBe('Free');
  });
});

describe('recruits at N2 (spec §4.2)', () => {
  it('merge into the first L crowd arriving with energy ≥ 50, with frozen energy and fear until then', () => {
    const sim = daySim();
    const r = sim.state.crowds.find((c) => c.recruit)!;
    const c = crowd(sim, { size: 5000, origin: 'N1', destination: 'N2', energy: 75 });
    run(sim, 20);
    expect(r.energy).toBe(60);
    expect(r.fear).toBe(10);
    runUntil(sim, () => c.state === 'Rallying');
    expect(c.size).toBe(7000);
    expect(sim.state.crowds.some((x) => x.recruit)).toBe(false);
    expect(sim.state.events.some((e) => e.kind === 'recruitsJoined')).toBe(true);
  });

  it('a crowd arriving below energy 50 does not pick them up', () => {
    const sim = daySim();
    const c = crowd(sim, { size: 5000, origin: 'N1', destination: 'N2', energy: 45 });
    runUntil(sim, () => c.state === 'Rallying' || c.state === 'Drifting');
    expect(c.size).toBeLessThan(5000 + 1);
    expect(sim.state.crowds.some((x) => x.recruit)).toBe(true);
  });
});

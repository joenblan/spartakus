import tuning from '../src/data/tuning.json';
import map from '../src/data/map.json';
import { addCrowd, createSim, planRoute, type CrowdInit, type Sim } from '../src/sim';

export { tuning, map };

/** The Day 5 start state from the spec. */
export function daySim(seed = 1): Sim {
  return createSim(tuning, map, seed);
}

/** The real street graph with no troops, phantoms or recruits, to isolate one rule at a time. */
export function emptySim(seed = 1): Sim {
  const sim = createSim(tuning, map, seed);
  sim.state.troops = [];
  sim.state.phantoms = [];
  sim.state.crowds = [];
  return sim;
}

/** Adds an L crowd and plans its route. */
export function crowd(sim: Sim, init: CrowdInit) {
  const c = addCrowd(sim, init);
  planRoute(sim, c);
  return c;
}

/** A crowd standing at a node as if it had already arrived there. */
export function standing(sim: Sim, node: string, init: Partial<CrowdInit> = {}) {
  const c = addCrowd(sim, { size: 5000, origin: node, destination: node, ...init });
  c.pos = { kind: 'node', node };
  c.state = node === c.destination ? 'Rallying' : 'Marching';
  c.arrivedOnce = true;
  return c;
}

export function guard(sim: Sim, node: string, doctrine: 'Hardened' | 'Wavering' = 'Hardened', posture: 'Guard' | 'Barracked' = 'Guard') {
  sim.state.troops.push({ id: `T-${node}`, node, men: 100, mgs: 0, posture, doctrine, nerve: 60, startNerve: 60 });
}

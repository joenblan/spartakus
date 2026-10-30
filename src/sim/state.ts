import { buildGraph, type Graph, type MapInput } from './graph';
import type { Crowd, NodeId, SimEvent, SimState, Tuning } from './types';

export interface Sim {
  tuning: Tuning;
  graph: Graph;
  state: SimState;
}

/** Fixed Day 5 start state (build spec §1), taken entirely from tuning. */
export function createSim(tuning: Tuning, map: MapInput, seed: number): Sim {
  const graph = buildGraph(map);
  const state: SimState = {
    t: 0,
    seed,
    rngState: seed >>> 0,
    crowds: [],
    troops: tuning.gTroops.map((u) => ({
      id: u.id,
      node: u.node,
      men: u.men,
      mgs: u.mgs,
      posture: u.posture as 'Guard' | 'Barracked',
      doctrine: u.doctrine as 'Hardened' | 'Wavering',
      nerve: u.nerve,
      startNerve: u.nerve,
    })),
    armed: tuning.lArmed.map((a) => ({ ...a, stance: 'Free' as const })),
    phantoms: tuning.phantoms.map((p, i) => ({ id: `PH${i + 1}`, ...p })),
    pools: { ...tuning.rallyPools },
    F: tuning.F0,
    C: tuning.C0,
    deathF: 0,
    volleys: [],
    events: [],
    nextId: 1,
  };
  const sim = { tuning, graph, state };
  const r = tuning.recruits;
  addCrowd(sim, { owner: 'N', size: r.size, energy: r.energy, fear: r.fear, origin: r.node, destination: r.node, recruit: true });
  return sim;
}

export interface CrowdInit {
  owner?: 'L' | 'N';
  size: number;
  origin: NodeId;
  destination: NodeId;
  energy?: number;
  fear?: number;
  recruit?: boolean;
}

/**
 * Places a crowd at its origin node. Does not plan its route (see movement.planRoute).
 * Summoning with stewards, pools, cooldowns and Forming (spec §4.1) is milestone 3.
 */
export function addCrowd(sim: Sim, init: CrowdInit): Crowd {
  const { state, tuning } = sim;
  const crowd: Crowd = {
    id: init.recruit ? `R${state.nextId++}` : `C${state.nextId++}`,
    owner: init.owner ?? 'L',
    size: init.size,
    energy: init.energy ?? tuning.lStart.energy,
    fear: init.fear ?? tuning.lStart.fear,
    origin: init.origin,
    destination: init.destination,
    pos: { kind: 'node', node: init.origin },
    path: [],
    state: init.origin === init.destination ? 'Rallying' : 'Marching',
    speaker: null,
    escort: null,
    arrivedOnce: false,
    prisoners: 0,
    cordonedAt: null,
    fleeing: false,
    panicSec: 0,
    shakenSec: 0,
    recruit: init.recruit ?? false,
    removed: false,
  };
  state.crowds.push(crowd);
  return crowd;
}

export function emit(sim: Sim, e: SimEvent): void {
  sim.state.events.push(e);
}

/** Node a crowd counts as being at: its node, or the node it presses while Cordoned. Null while walking an edge. */
export function crowdNode(c: Crowd): NodeId | null {
  if (c.cordonedAt) return c.cordonedAt;
  return c.pos.kind === 'node' ? c.pos.node : null;
}

/**
 * Nodes used to measure distance from a crowd: its node, or both ends while on an edge
 * (spec §4.5 "on an edge: measured from either end").
 */
export function crowdAnchorNodes(c: Crowd): NodeId[] {
  const n = crowdNode(c);
  if (n) return [n];
  if (c.pos.kind === 'edge') return [c.pos.from, c.pos.to];
  return [];
}

export function isGuardHeld(sim: Sim, node: NodeId): boolean {
  return sim.state.troops.some((u) => u.node === node && u.posture === 'Guard');
}

/**
 * Nodes the L side believes are held in Guard posture, phantoms included (spec §4.2).
 * SPEC-GAP: rumour fog (milestone 4) decides what is "reported". Until then troop positions are known exactly
 * and every phantom counts as reported.
 */
export function reportedGuardNodes(sim: Sim): Set<NodeId> {
  const s = new Set<NodeId>();
  for (const u of sim.state.troops) if (u.posture === 'Guard') s.add(u.node);
  for (const p of sim.state.phantoms) s.add(p.node);
  return s;
}

export function liveCrowds(sim: Sim): Crowd[] {
  return sim.state.crowds.filter((c) => !c.removed);
}

/** Every live crowd counting as at a node (cordoned crowds count at the node they press). */
export function crowdsAtNode(sim: Sim, node: NodeId): Crowd[] {
  return liveCrowds(sim).filter((c) => crowdNode(c) === node);
}

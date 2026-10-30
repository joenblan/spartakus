// Spec §4.5 Fear: crowd fear rates, spread, and noise from shots; city fear F.
import { hopDistance } from './graph';
import { crowdAnchorNodes, crowdNode, liveCrowds, type Sim } from './state';
import type { Crowd, NodeId, Side } from './types';
import type { RateBreakdown } from './energy';

function minHops(sim: Sim, from: NodeId[], to: NodeId): number {
  return Math.min(...from.map((n) => hopDistance(sim.graph, n, to)));
}

/** Adds fear, halving gains for escorted crowds (§4.5). Recruits' fear is frozen until they join (§4.2). */
export function addFear(sim: Sim, c: Crowd, amount: number): number {
  if (c.recruit) return 0;
  const { fear } = sim.tuning;
  const applied = amount > 0 && c.escort ? amount * fear.escortMult : amount;
  const before = c.fear;
  c.fear = Math.max(0, Math.min(fear.max, c.fear + applied));
  return c.fear - before;
}

export function addEnergy(sim: Sim, c: Crowd, amount: number): void {
  if (c.recruit) return;
  c.energy = Math.max(0, Math.min(sim.tuning.energy.max, c.energy + amount));
}

/** Threats in range that block recovery (§4.5). */
export function fearThreats(sim: Sim, c: Crowd): { adjHardened: boolean; phantom: boolean; recentVolley: boolean } {
  const { fear } = sim.tuning;
  const anchors = crowdAnchorNodes(c);
  if (!anchors.length) return { adjHardened: false, phantom: false, recentVolley: false };
  // SPEC-GAP: "adjacent to a Hardened G unit" is read literally as exactly 1 hop away (not at the unit's own node);
  // on an edge it is measured from either end, as the spec does for phantoms.
  const adjHardened = sim.state.troops.some(
    (u) => u.doctrine === 'Hardened' && anchors.some((n) => hopDistance(sim.graph, n, u.node) === fear.adjHardenedRange),
  );
  const phantom = sim.state.phantoms.some((p) => minHops(sim, anchors, p.node) <= fear.phantomRange);
  // SPEC-GAP: "volley in last 10 s" has no range in the spec; placeholder uses the volley noise range (2 nodes).
  const recentVolley = sim.state.volleys.some(
    (v) => sim.state.t - v.t < fear.volleyRecentSec && minHops(sim, anchors, v.node) <= fear.volleyRange,
  );
  return { adjHardened, phantom, recentVolley };
}

/** Fear change per minute for a crowd, by source (gains before the escort halving, which addFear applies). */
export function fearRates(sim: Sim, c: Crowd): RateBreakdown {
  const { fear, speakers } = sim.tuning;
  const r: RateBreakdown = {};
  const threats = fearThreats(sim, c);
  if (threats.adjHardened) r.adjHardened = fear.adjHardened;
  if (threats.phantom) r.phantom = fear.phantom;
  if (c.speaker) r.speaker = -speakers.roster[c.speaker].calm;
  if (!threats.adjHardened && !threats.phantom && !threats.recentVolley) r.recovery = -fear.recovery;
  return r;
}

function weightedFear(crowds: Crowd[]): number | null {
  const size = crowds.reduce((s, c) => s + c.size, 0);
  if (size <= 0) return null;
  return crowds.reduce((s, c) => s + c.fear * c.size, 0) / size;
}

/**
 * §4.5 Spread (every 5 s): fear moves 25% toward the size-weighted average of all crowds at its node and 10% toward
 * an adjacent node's average if higher. Only raises; max +5 per 5 s. Computed from one snapshot.
 * SPEC-GAP: with several adjacent nodes the spec names "the adjacent node"; placeholder uses the highest one.
 * SPEC-GAP: order of the +5 cap and the escort halving is unstated; placeholder caps first, then halves.
 * Crowds walking an edge are at no node and neither give nor take spread.
 */
export function spreadFear(sim: Sim): void {
  const { fear } = sim.tuning;
  const byNode = new Map<NodeId, Crowd[]>();
  for (const c of liveCrowds(sim)) {
    const n = crowdNode(c);
    if (!n) continue;
    if (!byNode.has(n)) byNode.set(n, []);
    byNode.get(n)!.push(c);
  }
  const avg = new Map<NodeId, number>();
  for (const [n, cs] of byNode) {
    const a = weightedFear(cs);
    if (a !== null) avg.set(n, a);
  }
  const gains: [Crowd, number][] = [];
  for (const [n, cs] of byNode) {
    const same = avg.get(n)!;
    let adjMax = -Infinity;
    for (const { to } of sim.graph.adj.get(n)!) if (avg.has(to)) adjMax = Math.max(adjMax, avg.get(to)!);
    for (const c of cs) {
      if (c.recruit) continue;
      let g = Math.max(0, fear.spreadSame * (same - c.fear));
      if (adjMax > c.fear) g += fear.spreadAdj * (adjMax - c.fear);
      g = Math.min(fear.spreadCap, g);
      if (g > 0) gains.push([c, g]);
    }
  }
  for (const [c, g] of gains) addFear(sim, c, g);
}

/**
 * §4.5 / §4.7 Noise of a volley at `node`: crowd fear by distance, outrage energy for the dead's own side within 1 node,
 * and city fear F. Who fires, and nerve effects, arrive with the government AI (milestone 4).
 * SPEC-GAP: §2 says a volley at N4 "carries noise 1 node further along boulevard edges"; how that maps onto the
 * same/1/2-node bands is unclear. Not applied yet; question raised for milestone 4.
 * SPEC-GAP: distance for a crowd walking an edge is not given for volleys; placeholder uses the nearer end, as for phantoms.
 */
export function applyVolleyNoise(sim: Sim, node: NodeId, dead: number, deadSide: Side): void {
  const { fear, energy, F } = sim.tuning;
  const s = sim.state;
  const bands = [fear.vSame, fear.v1, fear.v2]; // same node, within 1, within 2
  for (const c of liveCrowds(sim)) {
    const anchors = crowdAnchorNodes(c);
    if (!anchors.length) continue;
    const d = minHops(sim, anchors, node);
    const gain = bands[d] ?? 0;
    if (gain) addFear(sim, c, gain);
    if (dead > 0 && c.owner === deadSide && d <= 1) addEnergy(sim, c, energy.outrage);
  }
  s.volleys.push({ t: s.t, node });
  const deathF = Math.min(dead * F.death, F.deathCap - s.deathF);
  s.deathF += deathF;
  s.F += F.volley + deathF;
}

/** §4.5 Warning shots: +15 fear to crowds at the node (cordoned crowds pressing it count). */
export function applyWarningShots(sim: Sim, node: NodeId): void {
  for (const c of liveCrowds(sim)) if (crowdNode(c) === node) addFear(sim, c, sim.tuning.fear.warning);
}

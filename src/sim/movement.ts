// Spec §4.2 Movement, plus the flight leg of §4.12 panic.
import { edgeBetween } from './graph';
import { edgeSpeed, edgeTime } from './formulas';
import { emit, isGuardHeld, liveCrowds, reportedGuardNodes, type Sim } from './state';
import type { Crowd, NodeId } from './types';
import { EPSILON } from './units';

/** Fastest path (by travel time at this size) from `from` to `to`, never entering `excluded` nodes except `to`. */
export function fastestPath(sim: Sim, size: number, from: NodeId, to: NodeId, excluded: Set<NodeId>): { path: NodeId[]; time: number } | null {
  if (from === to) return { path: [], time: 0 };
  const { graph, tuning } = sim;
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const done = new Set<NodeId>();
  while (true) {
    let cur: NodeId | null = null;
    for (const [n, d] of dist) if (!done.has(n) && (cur === null || d < dist.get(cur)!)) cur = n;
    if (cur === null) return null;
    if (cur === to) break;
    done.add(cur);
    // Intermediate excluded nodes are never expanded through (the source is not intermediate).
    if (cur !== from && excluded.has(cur)) continue;
    for (const { edge, to: next } of graph.adj.get(cur)!) {
      if (done.has(next)) continue;
      const d = dist.get(cur)! + edgeTime(tuning, size, edge);
      if (d < (dist.get(next) ?? Infinity)) {
        dist.set(next, d);
        prev.set(next, cur);
      }
    }
  }
  const path: NodeId[] = [];
  for (let n: NodeId = to; n !== from; n = prev.get(n)!) path.unshift(n);
  return { path, time: dist.get(to)! };
}

/**
 * Plans the crowd's route to its destination from where it stands, per §4.2: fastest path avoiding every
 * intermediate node with reported Guard troops (phantoms included); if none exists, the plain fastest path.
 * On an edge the crowd may carry on or turn back, whichever is faster.
 * SPEC-GAP: the spec does not say whether a crowd re-planning mid-edge may turn back; taking the fastest of the
 * two directions is the plainest reading of "fastest path".
 */
export function planRoute(sim: Sim, c: Crowd, opts: { ignoreCordons?: boolean } = {}): void {
  const excluded = opts.ignoreCordons ? new Set<NodeId>() : reportedGuardNodes(sim);
  excluded.delete(c.destination);
  const best = bestRoute(sim, c, excluded) ?? bestRoute(sim, c, new Set());
  if (!best) throw new Error(`No route for ${c.id} to ${c.destination}`);
  if (best.reverse && c.pos.kind === 'edge') {
    c.pos = { kind: 'edge', edge: c.pos.edge, from: c.pos.to, to: c.pos.from, progress: 1 - c.pos.progress };
    c.cordonedAt = null;
  }
  c.path = best.path;
}

function bestRoute(sim: Sim, c: Crowd, excluded: Set<NodeId>): { path: NodeId[]; reverse: boolean } | null {
  const pos = c.pos;
  if (pos.kind === 'node') {
    const r = fastestPath(sim, c.size, pos.node, c.destination, excluded);
    return r && { path: r.path, reverse: false };
  }
  const edge = sim.graph.edges.get(pos.edge)!;
  const full = edgeTime(sim.tuning, c.size, edge);
  const options: { path: NodeId[]; time: number; reverse: boolean }[] = [];
  for (const [end, part, reverse] of [
    [pos.to, (1 - pos.progress) * full, false],
    [pos.from, pos.progress * full, true],
  ] as const) {
    if (end !== c.destination && excluded.has(end)) continue;
    const r = fastestPath(sim, c.size, end, c.destination, excluded);
    if (r) options.push({ path: [end, ...r.path], time: part + r.time, reverse });
  }
  if (!options.length) return null;
  options.sort((a, b) => a.time - b.time);
  return options[0];
}

/** §4.2 Re-route: when a new cordon on the path becomes known, crowds with fear ≥ rerouteFear re-plan. */
export function onCordonIntelChanged(sim: Sim): void {
  const guards = reportedGuardNodes(sim);
  for (const c of liveCrowds(sim)) {
    if (c.owner !== 'L' || c.fleeing || c.cordonedAt || c.path.length === 0) continue;
    if (c.fear < sim.tuning.fear.rerouteFear) continue;
    const intermediate = c.path.slice(0, -1);
    if (!intermediate.some((n) => guards.has(n))) continue;
    planRoute(sim, c);
    emit(sim, { t: sim.state.t, kind: 'rerouted', crowd: c.id, path: [...c.path] });
  }
}

/** Advances one crowd by one tick of movement. */
export function moveCrowd(sim: Sim, c: Crowd): void {
  if (c.removed || c.recruit || c.state === 'Forming') return;
  const { tuning } = sim;
  const ignoreCordons = c.state === 'Panicking';
  const speedMult = c.state === 'Panicking' ? tuning.panic.speedMult : 1;
  let budget = 1; // one tick of 1 s

  if (c.cordonedAt) {
    if (!ignoreCordons && isGuardHeld(sim, c.cordonedAt)) return;
    // The cordon is gone (or ignored by a panicking crowd): walk in.
    const node = c.cordonedAt;
    c.cordonedAt = null;
    if (c.state === 'Cordoned') c.state = 'Marching';
    emit(sim, { t: sim.state.t, kind: 'uncordoned', crowd: c.id, node });
    if (enterNode(sim, c, node)) return;
  }

  while (budget > EPSILON && !c.removed) {
    if (c.pos.kind === 'node') {
      if (c.path.length === 0) return;
      const next = c.path[0];
      const e = edgeBetween(sim.graph, c.pos.node, next);
      c.pos = { kind: 'edge', edge: e.id, from: c.pos.node, to: next, progress: 0 };
    }
    const pos = c.pos;
    if (pos.kind !== 'edge') return;
    const edge = sim.graph.edges.get(pos.edge)!;
    const secPerEdge = edge.blocks / (edgeSpeed(tuning, c.size, edge) * speedMult);
    const remaining = (1 - pos.progress) * secPerEdge;
    if (remaining > budget) {
      pos.progress += budget / secPerEdge;
      return;
    }
    budget -= remaining;
    pos.progress = 1;
    if (!ignoreCordons && isGuardHeld(sim, pos.to)) {
      // §4.2 Cordon: stop at the edge end, counted as at that node.
      c.cordonedAt = pos.to;
      if (c.state !== 'Shaken') c.state = 'Cordoned';
      emit(sim, { t: sim.state.t, kind: 'cordoned', crowd: c.id, node: pos.to });
      return;
    }
    if (enterNode(sim, c, pos.to)) return;
  }
}

/** Puts the crowd on a node. Returns true when it should stop moving this tick. */
function enterNode(sim: Sim, c: Crowd, node: NodeId): boolean {
  c.pos = { kind: 'node', node };
  if (c.path[0] === node) c.path.shift();
  joinRecruits(sim, c, node);
  if (node === c.destination && c.path.length === 0) {
    arrive(sim, c, node);
    return true;
  }
  return false;
}

/** §4.2 Arrival (+15 energy once per crowd life, then Rallying), or §4.12 reaching home after panic. */
export function arrive(sim: Sim, c: Crowd, node: NodeId): void {
  const { tuning } = sim;
  if (c.fleeing) {
    goHome(sim, c, node);
    return;
  }
  let bonus = 0;
  if (!c.arrivedOnce) {
    bonus = tuning.energy.arrival;
    c.energy = Math.min(tuning.energy.max, c.energy + bonus);
    c.arrivedOnce = true;
  }
  c.state = 'Rallying';
  emit(sim, { t: sim.state.t, kind: 'arrived', crowd: c.id, node, energyBonus: bonus });
}

/** §4.12 A fleeing crowd reaching its origin: a share returns to the pool, the rest is gone. */
export function goHome(sim: Sim, c: Crowd, node: NodeId): void {
  let returned = 0;
  if (node in sim.state.pools) {
    returned = Math.round(c.size * sim.tuning.panic.poolReturn);
    sim.state.pools[node] += returned;
  }
  // SPEC-GAP: a crowd whose origin has no pool (none exist on Day 5) simply leaves.
  c.removed = true;
  emit(sim, { t: sim.state.t, kind: 'home', crowd: c.id, node, returnedToPool: returned });
}

/** Folds `from` into `into`: sizes add, energy and fear size-weighted (§4.2 Merge). */
export function mergeInto(sim: Sim, into: Crowd, from: Crowd): void {
  const total = into.size + from.size;
  into.energy = (into.energy * into.size + from.energy * from.size) / total;
  into.fear = (into.fear * into.size + from.fear * from.size) / total;
  into.size = total;
  into.prisoners += from.prisoners;
  into.arrivedOnce = into.arrivedOnce || from.arrivedOnce;
  // §4.13 / §12 M18: the larger crowd's escort and speaker stay; the other escort becomes Free, the other speech ends.
  if (from.escort) {
    const unit = sim.state.armed.find((a) => a.id === from.escort);
    if (unit) unit.stance = 'Free';
  }
  from.removed = true;
}

/** §4.2 Recruits at N2 merge into the first L crowd that arrives with energy ≥ joinEnergy. */
function joinRecruits(sim: Sim, c: Crowd, node: NodeId): void {
  if (c.owner !== 'L' || c.energy < sim.tuning.recruits.joinEnergy) return;
  const r = sim.state.crowds.find((x) => x.recruit && !x.removed && x.pos.kind === 'node' && x.pos.node === node);
  if (!r) return;
  // §12 M4: no merge above the blob cap.
  if (c.size + r.size > sim.tuning.blobCap) return;
  const size = r.size;
  mergeInto(sim, c, r);
  emit(sim, { t: sim.state.t, kind: 'recruitsJoined', crowd: c.id, node, size });
}

/**
 * §4.2 Merge: two L crowds at one node with the same destination merge, unless the result would exceed the cap (§12 M4).
 * SPEC-GAP: the spec does not say whether Cordoned crowds or fleeing (Panicking/Shaken) crowds merge.
 * Placeholder: only crowds standing on the node and not fleeing merge.
 */
export function resolveMerges(sim: Sim): void {
  const candidates = liveCrowds(sim)
    .filter((c) => c.owner === 'L' && !c.recruit && !c.fleeing && !c.cordonedAt && c.pos.kind === 'node')
    .sort((a, b) => b.size - a.size || a.id.localeCompare(b.id));
  for (const c of candidates) {
    if (c.removed || c.pos.kind !== 'node') continue;
    const node = c.pos.node;
    const into = candidates.find(
      (k) =>
        k !== c &&
        !k.removed &&
        k.size >= c.size &&
        candidates.indexOf(k) < candidates.indexOf(c) &&
        k.destination === c.destination &&
        k.pos.kind === 'node' &&
        k.pos.node === node &&
        k.size + c.size <= sim.tuning.blobCap,
    );
    if (!into) continue;
    mergeInto(sim, into, c);
    emit(sim, { t: sim.state.t, kind: 'merged', into: into.id, from: c.id, node });
  }
}


// Entity formulas from spec §3.
import type { Graph, GraphEdge } from './graph';
import type { Crowd, NodeId, Tuning } from './types';
import { PERCENT } from './units';

/** §3.1 Speed in blocks/s on an edge of the given capacity. Floor applied last. */
export function crowdSpeed(t: Tuning, size: number, capacity: number): number {
  const raw = t.speed.base * (1 - size / t.speed.sizeDiv) * Math.min(1, capacity / size);
  return Math.max(t.speed.floor, raw);
}

export function edgeSpeed(t: Tuning, size: number, edge: GraphEdge): number {
  return crowdSpeed(t, size, t.capacity[edge.kind]);
}

/** Seconds to cross a whole edge at the given size. */
export function edgeTime(t: Tuning, size: number, edge: GraphEdge): number {
  return edge.blocks / edgeSpeed(t, size, edge);
}

/** Seconds to walk a node path (list of consecutive nodes) at a fixed size. */
export function pathTravelTime(t: Tuning, g: Graph, size: number, path: NodeId[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const link = g.adj.get(path[i - 1])!.find((l) => l.to === path[i]);
    if (!link) throw new Error(`No edge ${path[i - 1]}-${path[i]}`);
    total += edgeTime(t, size, link.edge);
  }
  return total;
}

/** §3.1 Pressure. Panicking or Shaken: 0. */
export function pressure(t: Tuning, c: Crowd): number {
  if (c.state === 'Panicking' || c.state === 'Shaken') return 0;
  const p = c.size * (c.energy / PERCENT) * (1 - c.fear / PERCENT);
  return c.escort ? p * t.escort.pressureMult : p;
}

/** §3.1 Presence of a crowd. Panicking, Forming or on an edge: 0. Cordoned: share at the pressed node. */
export function crowdPresence(t: Tuning, c: Crowd): number {
  if (c.state === 'Panicking' || c.state === 'Forming') return 0;
  const full = c.size * (t.presence.base + c.energy / t.presence.energyDiv);
  if (c.cordonedAt) return full * t.presence.cordonedShare;
  if (c.pos.kind === 'edge') return 0;
  return full;
}

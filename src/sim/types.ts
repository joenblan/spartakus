import type tuningJson from '../data/tuning.json';
import type mapJson from '../data/map.json';

export type Tuning = typeof tuningJson;
export type MapData = typeof mapJson;

export type NodeId = string;
export type EdgeId = string;
export type Side = 'L' | 'G' | 'N';
export type EdgeKind = keyof Tuning['capacity'];
export type SpeakerId = keyof Tuning['speakers']['roster'];

export type CrowdState =
  | 'Forming'
  | 'Marching'
  | 'Rallying'
  | 'Cordoned'
  | 'Restless'
  | 'Surging'
  | 'Panicking'
  | 'Shaken'
  | 'Recalled'
  | 'Drifting'
  | 'Dispersed';

export type Pos =
  | { kind: 'node'; node: NodeId }
  | { kind: 'edge'; edge: EdgeId; from: NodeId; to: NodeId; progress: number };

export interface Crowd {
  id: string;
  owner: 'L' | 'N';
  size: number;
  energy: number;
  fear: number;
  origin: NodeId;
  destination: NodeId;
  pos: Pos;
  /** Nodes still to enter, in order; the last one is the destination. Empty when standing at the destination. */
  path: NodeId[];
  state: CrowdState;
  /** Speaker currently speaking to this crowd (speaker lifecycle arrives with interventions, milestone 3). */
  speaker: SpeakerId | null;
  /** Bound armed unit id (escorts arrive with interventions, milestone 3). */
  escort: string | null;
  arrivedOnce: boolean;
  prisoners: number;
  /** Node whose cordon this crowd is stopped against, while Cordoned. */
  cordonedAt: NodeId | null;
  /** Set on panic; stays until the crowd gets home (through Panicking and Shaken). */
  fleeing: boolean;
  panicSec: number;
  shakenSec: number;
  /** Neutral recruits: no decay, energy and fear frozen until they join. */
  recruit: boolean;
  /** Left the map this tick (dispersed, merged away, or home); swept at the end of the tick. */
  removed: boolean;
}

export interface GTroop {
  id: string;
  node: NodeId;
  men: number;
  mgs: number;
  posture: 'Guard' | 'Barracked' | 'Stand-aside';
  doctrine: 'Hardened' | 'Wavering';
  nerve: number;
  startNerve: number;
}

export interface LArmed {
  id: string;
  node: NodeId;
  men: number;
  mgs: number;
  nerve: number;
  stance: 'Free' | 'Escorting' | 'Garrison';
}

export interface Phantom {
  id: string;
  node: NodeId;
  label: string;
  reported: number;
}

export interface VolleyRecord {
  t: number;
  node: NodeId;
}

export type SimEvent =
  | { t: number; kind: 'arrived'; crowd: string; node: NodeId; energyBonus: number }
  | { t: number; kind: 'cordoned'; crowd: string; node: NodeId }
  | { t: number; kind: 'uncordoned'; crowd: string; node: NodeId }
  | { t: number; kind: 'merged'; into: string; from: string; node: NodeId }
  | { t: number; kind: 'recruitsJoined'; crowd: string; node: NodeId; size: number }
  | { t: number; kind: 'rerouted'; crowd: string; path: NodeId[] }
  | { t: number; kind: 'panic'; crowd: string; fear: number }
  | { t: number; kind: 'shaken'; crowd: string }
  | { t: number; kind: 'drifting'; crowd: string; energy: number }
  | { t: number; kind: 'home'; crowd: string; node: NodeId; returnedToPool: number }
  | { t: number; kind: 'dispersed'; crowd: string; cause: 'energy' | 'size'; remnantTo: string | null };

export interface SimState {
  t: number;
  seed: number;
  rngState: number;
  crowds: Crowd[];
  troops: GTroop[];
  armed: LArmed[];
  phantoms: Phantom[];
  /** True remaining rally pools. */
  pools: Record<NodeId, number>;
  /** City fear. */
  F: number;
  /** Credibility. */
  C: number;
  /** F already added from deaths this phase (capped by tuning.F.deathCap). */
  deathF: number;
  volleys: VolleyRecord[];
  events: SimEvent[];
  nextId: number;
}

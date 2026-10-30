// Spec §4.12 Panic, Shaken, dispersal and §4.4 Drifting (tick step 11).
import { driftLossPerMin } from './energy';
import { goHome, mergeInto, planRoute } from './movement';
import { crowdNode, emit, liveCrowds, type Sim } from './state';
import type { Crowd } from './types';
import { SEC_PER_10S, SEC_PER_MIN } from './units';

/** §4.12 Panic: flee to origin ignoring cordons. */
export function startPanic(sim: Sim, c: Crowd): void {
  emit(sim, { t: sim.state.t, kind: 'panic', crowd: c.id, fear: c.fear });
  c.state = 'Panicking';
  c.fleeing = true;
  c.panicSec = 0;
  c.shakenSec = 0;
  c.destination = c.origin;
  if (c.pos.kind === 'node' && c.pos.node === c.origin) {
    // Already home: it reaches its origin at once.
    goHome(sim, c, c.origin);
    return;
  }
  planRoute(sim, c, { ignoreCordons: true });
}

export function updateCrowdStates(sim: Sim): void {
  const { tuning } = sim;
  for (const c of liveCrowds(sim)) {
    if (c.recruit || c.removed) continue;

    // Panic (Shaken crowds can panic again, §12 N7).
    if (c.fear >= tuning.fear.panic && c.state !== 'Panicking') {
      startPanic(sim, c);
      if (c.removed) continue;
    }

    if (c.state === 'Panicking') {
      c.panicSec += 1;
      c.size *= 1 - tuning.panic.lossPer10s / SEC_PER_10S;
      if (c.panicSec >= tuning.panic.duration) {
        c.state = 'Shaken';
        c.fear = tuning.panic.shakenFear;
        c.shakenSec = tuning.panic.shakenSec;
        c.energy = Math.min(c.energy, tuning.panic.shakenEnergyCap);
        emit(sim, { t: sim.state.t, kind: 'shaken', crowd: c.id });
      }
    } else if (c.state === 'Shaken') {
      c.shakenSec -= 1;
      if (c.shakenSec <= 0) {
        // SPEC-GAP: the spec does not say what a Shaken crowd becomes after 60 s. Placeholder: it keeps walking
        // home as an ordinary crowd and still returns its share to the pool on arrival.
        c.state = c.cordonedAt ? 'Cordoned' : 'Marching';
      }
    }

    // §4.4 Drifting.
    const loss = driftLossPerMin(sim, c);
    if (loss > 0) c.size *= 1 - loss / SEC_PER_MIN;
    if (c.energy < tuning.energy.drift30Below && (c.state === 'Marching' || c.state === 'Rallying')) {
      c.state = 'Drifting';
      emit(sim, { t: sim.state.t, kind: 'drifting', crowd: c.id, energy: c.energy });
    } else if (c.state === 'Drifting' && c.energy >= tuning.energy.drift30Below) {
      c.state = c.path.length ? 'Marching' : 'Rallying';
    }

    // §4.12 Dispersal.
    if (c.energy <= 0 || c.size < tuning.dispersal.minSize) disperse(sim, c, c.energy <= 0 ? 'energy' : 'size');
  }
}

/**
 * Removes a crowd; its remnant merges into a friendly crowd at its node, else goes home.
 * SPEC-GAP: which friendly crowd (placeholder: the largest) and whether a remnant going home refills the pool
 * (placeholder: no, it leaves the map).
 */
export function disperse(sim: Sim, c: Crowd, cause: 'energy' | 'size'): void {
  const node = crowdNode(c);
  const friend = node
    ? liveCrowds(sim)
        .filter((x) => x !== c && x.owner === c.owner && !x.recruit && crowdNode(x) === node)
        .sort((a, b) => b.size - a.size)[0]
    : undefined;
  if (friend) mergeInto(sim, friend, c);
  c.removed = true;
  c.state = 'Dispersed';
  emit(sim, { t: sim.state.t, kind: 'dispersed', crowd: c.id, cause, remnantTo: friend?.id ?? null });
}

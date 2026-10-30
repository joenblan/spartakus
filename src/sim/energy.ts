// Spec §4.3 Energy and §4.4 Drifting rates.
import { crowdNode, type Sim } from './state';
import type { Crowd } from './types';

export type RateBreakdown = Record<string, number>;

/** Energy change per minute for a crowd, by source. */
export function energyRates(sim: Sim, c: Crowd): RateBreakdown {
  const { energy, speakers } = sim.tuning;
  const r: RateBreakdown = { decay: -energy.decay };
  // SPEC-GAP: §4.3 says "Waiting at a non-destination node (Cordoned)". A crowd cordoned against its own destination
  // has not reached it either, so every Cordoned crowd pays the extra decay.
  if (c.cordonedAt) r.waiting = -energy.waitDecay;
  if (c.fear > energy.fearAbove) r.fear = -Math.min(energy.fearCap, (c.fear - energy.fearAbove) / energy.fearDiv);
  if (c.speaker) {
    const node = crowdNode(c);
    let gain = speakers.roster[c.speaker].gain;
    if (node === speakers.siegesalleeNode) gain *= speakers.siegesallee;
    if (c.speaker === 'Eichhorn' && node === speakers.eichhornNode) gain *= speakers.eichhornN9;
    r.speaker = gain;
  }
  return r;
}

/** §4.4 Size loss per minute (as a fraction) from low energy. */
export function driftLossPerMin(sim: Sim, c: Crowd): number {
  const e = sim.tuning.energy;
  if (c.energy < e.drift15Below) return e.drift15;
  if (c.energy < e.drift30Below) return e.drift30;
  return 0;
}

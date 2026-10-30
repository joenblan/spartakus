// Spec §4.0 tick order. One call = one simulated second.
import { addEnergy, addFear, fearRates, spreadFear } from './fear';
import { energyRates } from './energy';
import { updateCrowdStates } from './crowdStates';
import { moveCrowd, resolveMerges } from './movement';
import { liveCrowds, type Sim } from './state';
import { SEC_PER_MIN } from './units';

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export function isPhaseOver(sim: Sim): boolean {
  return sim.state.t >= sim.tuning.phaseLength;
}

export function step(sim: Sim): void {
  const { state, tuning } = sim;
  if (isPhaseOver(sim)) return;

  // 1. Timers. (Dusk, cooldowns, steward regen and fog reroll arrive with later milestones.)
  state.volleys = state.volleys.filter((v) => state.t - v.t < tuning.fear.volleyRecentSec);

  // 2. Movement: positions, arrivals, cordon stops, merges, recruit join.
  for (const c of liveCrowds(sim)) moveCrowd(sim, c);
  resolveMerges(sim);

  // 3. Reveal; 4. Pressure; 5. Nerve; 6. Doctrine timers; 7. Panic-fire checks; 8. Volleys: milestone 4.

  // 9. Energy and fear rates; fear spread every 5 s.
  for (const c of liveCrowds(sim)) {
    if (c.recruit) continue;
    addEnergy(sim, c, sum(energyRates(sim, c)) / SEC_PER_MIN);
    if (c.state === 'Shaken') c.energy = Math.min(c.energy, tuning.panic.shakenEnergyCap);
    const f = fearRates(sim, c);
    for (const v of Object.values(f)) addFear(sim, c, v / SEC_PER_MIN);
  }
  if (state.t % tuning.fear.spreadEvery === 0) spreadFear(sim);

  // 10. Clash resolution: not used on Day 5.

  // 11. State changes: panic, Shaken, drifting, dispersal.
  updateCrowdStates(sim);

  // 12. Control, SP and AI rules: milestones 4 and 5.

  // 13. Events are emitted as they happen; sweep crowds that left the map.
  state.crowds = state.crowds.filter((c) => !c.removed);
  state.t += 1;
}

/** Runs `n` ticks (stops at phase end). */
export function run(sim: Sim, n: number): void {
  for (let i = 0; i < n && !isPhaseOver(sim); i++) step(sim);
}

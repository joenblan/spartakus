// TEMPORARY (milestone 2 only): there is no player input until milestone 3, so a few crowds are placed at t = 0
// to show movement, cordons, recruits joining and drifting. Remove when summoning arrives.
import { addCrowd, planRoute, type Sim } from '../sim';

export function addDemoCrowds(sim: Sim): void {
  const crowds = [
    { size: 8000, origin: 'N1', destination: 'N9' }, // the long march to Alexanderplatz
    { size: 3500, origin: 'N1', destination: 'N2', energy: 75 }, // picks up the Siegesallee recruits
    { size: 4000, origin: 'N9', destination: 'N12' }, // cordoned by the Vorwärts guard
    { size: 2500, origin: 'N9', destination: 'N14' }, // to the Pioneer barracks gate (Barracked: walks in)
  ];
  for (const init of crowds) planRoute(sim, addCrowd(sim, init));
}

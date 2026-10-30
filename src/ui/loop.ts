// Real-time driver: runs sim ticks at the chosen speed and draws every animation frame with interpolation.
import { crowdPoint, type Pt } from '../render/view';
import { isPhaseOver, step, type Sim } from '../sim';

export type Speed = 0 | 1 | 3;

export interface Loop {
  speed: Speed;
  setSpeed(s: Speed): void;
  onChange?: () => void;
}

const MS_PER_TICK = 1000; // sim ticks at 1 Hz at 1× speed

export function startLoop(sim: Sim, draw: (prev: Map<string, Pt>, alpha: number, nowMs: number) => void): Loop {
  let prev = new Map<string, Pt>();
  let acc = 0;
  let last = performance.now();
  const loop: Loop = {
    speed: 1,
    setSpeed(s) {
      loop.speed = s;
      loop.onChange?.();
    },
  };

  function frame(now: number) {
    const dt = Math.min(now - last, MS_PER_TICK); // don't fast-forward after a hidden tab
    last = now;
    if (loop.speed > 0 && !isPhaseOver(sim)) {
      acc += dt * loop.speed;
      while (acc >= MS_PER_TICK && !isPhaseOver(sim)) {
        prev = new Map(sim.state.crowds.map((c) => [c.id, crowdPoint(sim.graph, c)]));
        step(sim);
        acc -= MS_PER_TICK;
        loop.onChange?.();
      }
    }
    const alpha = isPhaseOver(sim) ? 1 : acc / MS_PER_TICK;
    draw(prev, alpha, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return loop;
}

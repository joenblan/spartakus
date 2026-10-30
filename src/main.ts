import tuning from './data/tuning.json';
import map from './data/map.json';
import { createSim } from './sim';
import { drawFrame } from './render/draw';
import { colors } from './render/theme';
import { makeLayout } from './render/view';
import { mountSpeedControls } from './ui/controls';
import { addDemoCrowds } from './ui/demo';
import { startLoop } from './ui/loop';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1);
const sim = createSim(tuning, map, seed);
if (params.get('demo') !== '0') addDemoCrowds(sim);

document.body.style.margin = '0';
document.body.style.background = colors.paper;
document.body.style.overflow = 'hidden';
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

let layout = makeLayout(sim.graph, window.innerWidth, window.innerHeight);
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout = makeLayout(sim.graph, window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

const loop = startLoop(sim, (prev, alpha, nowMs) => drawFrame(ctx, { sim, layout, prev, alpha, nowMs }));
mountSpeedControls(loop, document.body);

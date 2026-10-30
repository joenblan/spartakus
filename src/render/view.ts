// Pure helpers for placing and labelling things on screen. No canvas calls here, so they can be unit-tested.
import type { Crowd, Graph, NodeId, Tuning } from '../sim';
import { sizes } from './theme';

export interface Pt {
  x: number;
  y: number;
}

export interface Layout {
  width: number;
  height: number;
  toScreen(p: Pt): Pt;
}

/** Fits the graph's grid coordinates into the canvas below the top bar, keeping the aspect ratio. */
export function makeLayout(graph: Graph, width: number, height: number): Layout {
  const xs = [...graph.nodes.values()].map((n) => n.x);
  const ys = [...graph.nodes.values()].map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const top = sizes.topBar + sizes.margin;
  const availW = Math.max(1, width - 2 * sizes.margin);
  const availH = Math.max(1, height - top - sizes.margin);
  const scale = Math.min(availW / spanX, availH / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = top + (availH - spanY * scale) / 2;
  return {
    width,
    height,
    toScreen: (p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }),
  };
}

export function nodePoint(graph: Graph, id: NodeId): Pt {
  const n = graph.nodes.get(id)!;
  return { x: n.x, y: n.y };
}

/** Crowd position in grid coordinates (on an edge: interpolated along it). */
export function crowdPoint(graph: Graph, c: Crowd): Pt {
  if (c.pos.kind === 'node') return nodePoint(graph, c.pos.node);
  const a = nodePoint(graph, c.pos.from);
  const b = nodePoint(graph, c.pos.to);
  return lerp(a, b, c.pos.progress);
}

export function lerp(a: Pt, b: Pt, k: number): Pt {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** Blob radius grows with the square root of size, so area tracks headcount. */
export function blobRadius(size: number): number {
  return Math.max(sizes.blobMin, Math.min(sizes.blobMax, sizes.blobK * Math.sqrt(size)));
}

/** Confirmed sizes are exact; reported (unconfirmed) sizes get a "~" prefix. */
export function sizeLabel(size: number, reported: boolean): string {
  const n = Math.round(size).toLocaleString('en-US');
  return reported ? `~${n}` : n;
}

/** Spec conventions: clock label = clockStart + t × clockRate game minutes. */
export function clockLabel(t: number, tuning: Tuning): string {
  const [h, m] = tuning.clockStart.split(':').map(Number);
  const total = h * 60 + m + Math.floor(t * tuning.clockRate);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Short glyph for a crowd's state (spec §8 state icons), drawn as text. */
export function stateGlyph(c: Crowd): string {
  if (c.state === 'Panicking') return '⊘'; // locked: interventions disabled
  if (c.speaker) return '❝';
  switch (c.state) {
    case 'Marching':
    case 'Surging':
      return '➜';
    case 'Rallying':
      return '⚑';
    case 'Cordoned':
      return '⊣';
    case 'Restless':
      return '~';
    case 'Recalled':
    case 'Shaken':
      return '⌂';
    case 'Drifting':
      return '⋯';
    default:
      return '';
  }
}

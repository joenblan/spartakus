// Canvas drawing of one frame. Reads the sim; never changes it.
import type { Crowd, GTroop, LArmed, Phantom, Sim } from '../sim';
import { defaultPlacement, placement } from './placement';
import { colors, fonts, sizes } from './theme';
import { blobRadius, clockLabel, crowdPoint, lerp, nodePoint, sizeLabel, stateGlyph, type Layout, type Pt } from './view';

export interface FrameInput {
  sim: Sim;
  layout: Layout;
  /** Crowd grid positions before the last tick, for interpolation. */
  prev: Map<string, Pt>;
  /** 0..1 progress toward the next tick. */
  alpha: number;
  nowMs: number;
}

export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameInput): void {
  const { sim, layout } = f;
  const dusk = sim.state.t >= sim.tuning.duskStart;
  ctx.fillStyle = dusk ? colors.paperDusk : colors.paper;
  ctx.fillRect(0, 0, layout.width, layout.height);
  drawEdges(ctx, f);
  drawNodes(ctx, f);
  drawUnits(ctx, f);
  drawLabels(ctx, f);
  drawCrowds(ctx, f);
  if (dusk) {
    ctx.fillStyle = colors.duskTint;
    ctx.fillRect(0, sizes.topBar, layout.width, layout.height - sizes.topBar);
  }
  drawTopBar(ctx, f, dusk);
}

function drawEdges(ctx: CanvasRenderingContext2D, { sim, layout }: FrameInput) {
  ctx.strokeStyle = colors.street;
  ctx.lineCap = 'round';
  for (const e of sim.graph.edges.values()) {
    const a = layout.toScreen(nodePoint(sim.graph, e.a));
    const b = layout.toScreen(nodePoint(sim.graph, e.b));
    ctx.lineWidth = sizes.edgeWidth[e.kind];
    ctx.setLineDash(e.kind === 'bridge' ? sizes.bridgeDash : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawNodes(ctx: CanvasRenderingContext2D, { sim, layout }: FrameInput) {
  for (const n of sim.graph.nodes.values()) {
    const p = layout.toScreen(n);
    ctx.fillStyle = colors.nodeFill;
    ctx.strokeStyle = colors.street;
    ctx.lineWidth = sizes.outline;
    ctx.beginPath();
    ctx.arc(p.x, p.y, sizes.nodeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Node names and ids with a paper halo, so streets don't cut through them. Crowds draw on top. */
function drawLabels(ctx: CanvasRenderingContext2D, { sim, layout }: FrameInput) {
  ctx.lineJoin = 'round';
  for (const n of sim.graph.nodes.values()) {
    const p = layout.toScreen(n);
    const side = (placement[n.id] ?? defaultPlacement).label;
    const d = sizes.nodeRadius + sizes.labelGap;
    const x = side === 'e' ? p.x + d : side === 'w' ? p.x - d : p.x;
    const y = side === 'n' ? p.y - d : side === 's' ? p.y + d + sizes.labelSize : p.y;
    ctx.textAlign = side === 'e' ? 'left' : side === 'w' ? 'right' : 'center';
    ctx.textBaseline = side === 'n' ? 'bottom' : side === 's' ? 'top' : 'middle';
    halo(ctx, `${sizes.labelSize}px ${fonts.serif}`, n.name, x, y, colors.label);
    const idY = side === 's' ? y + sizes.labelSize * 1.2 : y - sizes.labelSize * 1.2;
    // Weight pips (spec §8) follow the id.
    halo(ctx, `${sizes.numberSize}px ${fonts.sans}`, `${n.id} ${'●'.repeat(n.weight)}`, x, idY, colors.inkSoft);
  }
}

function halo(ctx: CanvasRenderingContext2D, font: string, text: string, x: number, y: number, color: string) {
  ctx.font = font;
  ctx.strokeStyle = colors.paper;
  ctx.lineWidth = sizes.halo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

type UnitBox = { kind: 'G'; u: GTroop } | { kind: 'L'; u: LArmed } | { kind: 'P'; u: Phantom };

function drawUnits(ctx: CanvasRenderingContext2D, { sim, layout }: FrameInput) {
  const byNode = new Map<string, UnitBox[]>();
  const add = (node: string, b: UnitBox) => {
    if (!byNode.has(node)) byNode.set(node, []);
    byNode.get(node)!.push(b);
  };
  for (const u of sim.state.troops) add(u.node, { kind: 'G', u });
  for (const u of sim.state.armed) if (u.stance !== 'Escorting') add(u.node, { kind: 'L', u });
  for (const u of sim.state.phantoms) add(u.node, { kind: 'P', u });
  const { w, h, gap, offset } = sizes.unit;
  for (const [node, boxes] of byNode) {
    const p = layout.toScreen(nodePoint(sim.graph, node));
    const side = (placement[node] ?? defaultPlacement).units;
    const stackH = boxes.length * h + (boxes.length - 1) * gap;
    // Boxes stack vertically on the chosen side of the node.
    const x0 = side === 'e' ? p.x + offset : side === 'w' ? p.x - offset - w : p.x - w / 2;
    const y0 = side === 's' ? p.y + offset : side === 'n' ? p.y - offset - stackH : p.y - stackH / 2;
    boxes.forEach((b, i) => drawUnitBox(ctx, b, x0, y0 + i * (h + gap), w, h));
  }
}

function drawUnitBox(ctx: CanvasRenderingContext2D, b: UnitBox, x: number, y: number, w: number, h: number) {
  const side = b.kind === 'L' ? colors.faction.L : colors.faction.G;
  ctx.fillStyle = side.fill;
  ctx.strokeStyle = side.main;
  ctx.lineWidth = sizes.outline;
  ctx.setLineDash(b.kind === 'P' ? sizes.reportedDash : []);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${sizes.numberSize}px ${fonts.sans}`;
  const main =
    b.kind === 'P'
      ? `${b.u.label} ${sizeLabel(b.u.reported, true)}?`
      : `${b.u.id}  ${b.u.men} men${b.u.mgs ? ` · ${b.u.mgs} MG` : ''}`;
  ctx.fillText(main, x + w / 2, y + h * 0.32);
  ctx.font = `${sizes.numberSize - 2}px ${fonts.sans}`;
  const tag =
    b.kind === 'G'
      ? `${b.u.posture.toUpperCase()} · ${b.u.doctrine.toUpperCase()}`
      : b.kind === 'L'
        ? b.u.stance.toUpperCase()
        : 'UNCONFIRMED REPORT';
  ctx.fillText(tag, x + w / 2, y + h * 0.72);
  if (b.kind !== 'P') {
    // Nerve bar
    const start = b.kind === 'G' ? b.u.startNerve : b.u.nerve;
    bar(ctx, x, y - sizes.bar.height - sizes.bar.gap, w, b.u.nerve / Math.max(start, 1), side.main);
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string) {
  ctx.fillStyle = colors.barBack;
  ctx.fillRect(x, y, w, sizes.bar.height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), sizes.bar.height);
}

function drawCrowds(ctx: CanvasRenderingContext2D, f: FrameInput) {
  const { sim, layout, prev, alpha } = f;
  const crowds = sim.state.crowds.filter((c) => !c.removed);
  // Interpolated positions, then spread crowds that share a spot so none hides another.
  const placed = crowds.map((c) => {
    const now = crowdPoint(sim.graph, c);
    const before = prev.get(c.id) ?? now;
    return { c, p: layout.toScreen(lerp(before, now, alpha)), r: blobRadius(c.size) };
  });
  const groups = new Map<string, typeof placed>();
  for (const item of placed) {
    const c = item.c;
    const key = c.cordonedAt ? `cordon:${c.cordonedAt}:${c.pos.kind === 'edge' ? c.pos.edge : ''}` : c.pos.kind === 'node' ? `node:${c.pos.node}` : `edge:${c.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const spread = Math.max(...g.map((i) => i.r)) * sizes.stack;
    g.forEach((item, i) => {
      const ang = (i / g.length) * Math.PI * 2 - Math.PI / 2;
      item.p = { x: item.p.x + Math.cos(ang) * spread, y: item.p.y + Math.sin(ang) * spread };
    });
  }
  separate(placed);
  for (const { c, p } of placed) drawDestination(ctx, f, c, p);
  for (const { c, p, r } of placed.sort((a, b) => b.r - a.r)) drawCrowd(ctx, f, c, p, r);
}

/** Pushes overlapping blobs apart a little so every size label stays readable. */
function separate(items: { p: Pt; r: number }[]) {
  for (let pass = 0; pass < sizes.separationPasses; pass++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const min = (a.r + b.r) * sizes.blobSeparation;
        const dx = b.p.x - a.p.x;
        const dy = b.p.y - a.p.y;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        const ux = d > 0 ? dx / d : 1;
        const uy = d > 0 ? dy / d : 0;
        const push = (min - d) / 2;
        a.p = { x: a.p.x - ux * push, y: a.p.y - uy * push };
        b.p = { x: b.p.x + ux * push, y: b.p.y + uy * push };
      }
    }
  }
}

function drawDestination(ctx: CanvasRenderingContext2D, { sim, layout }: FrameInput, c: Crowd, from: Pt) {
  if (!c.path.length) return;
  ctx.strokeStyle = colors.faction[c.owner].main;
  ctx.globalAlpha = sizes.destinationAlpha;
  ctx.lineWidth = 1;
  ctx.setLineDash(c.state === 'Surging' || c.state === 'Restless' ? sizes.reportedDash : []);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (const n of c.path) {
    const q = layout.toScreen(nodePoint(sim.graph, n));
    ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawCrowd(ctx: CanvasRenderingContext2D, { nowMs }: FrameInput, c: Crowd, p: Pt, r: number) {
  const side = colors.faction[c.owner];
  // SPEC-GAP (until milestone 4): no fog yet, so every size is confirmed and drawn solid.
  const reported = false;
  const flash = c.state === 'Panicking' && Math.floor(nowMs / sizes.panicFlashMs) % 2 === 0;
  ctx.fillStyle = side.fill;
  ctx.strokeStyle = flash ? colors.panicFlash : side.main;
  ctx.lineWidth = sizes.outline;
  ctx.setLineDash(reported ? sizes.reportedDash : []);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  // Size label inside the blob, state glyph beside it.
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${sizes.numberSize}px ${fonts.sans}`;
  ctx.fillText(sizeLabel(c.size, reported), p.x, p.y);
  const glyph = stateGlyph(c);
  if (glyph) {
    ctx.font = `${sizes.labelSize}px ${fonts.sans}`;
    ctx.fillStyle = side.main;
    ctx.fillText(glyph, p.x + r + sizes.labelSize * 0.6, p.y - r * 0.6);
  }

  // Energy bar, then fear bar, under the blob.
  const { width, height, gap } = sizes.bar;
  const x = p.x - width / 2;
  const y = p.y + r + gap * 2;
  bar(ctx, x, y, width, c.energy / 100, colors.energy);
  bar(ctx, x, y + height + gap, width, c.fear / 100, colors.fear);
}

function drawTopBar(ctx: CanvasRenderingContext2D, { sim, layout }: FrameInput, dusk: boolean) {
  const h = sizes.topBar;
  ctx.fillStyle = colors.nodeFill;
  ctx.fillRect(0, 0, layout.width, h);
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h + 0.5);
  ctx.lineTo(layout.width, h + 0.5);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.ink;
  ctx.font = `bold ${sizes.headingSize}px ${fonts.serif}`;
  ctx.fillText('Berlin, 5 January 1919', sizes.topBarX.title, h / 2);

  // Clock with dusk tint.
  const clockX = sizes.topBarX.clock;
  ctx.font = `bold ${sizes.headingSize + 4}px ${fonts.sans}`;
  ctx.fillStyle = dusk ? colors.fear : colors.ink;
  ctx.fillText(clockLabel(sim.state.t, sim.tuning), clockX, h / 2);
  ctx.font = `${sizes.numberSize}px ${fonts.sans}`;
  ctx.fillStyle = colors.inkSoft;
  ctx.fillText(dusk ? 'dusk' : `t ${sim.state.t}s`, sizes.topBarX.clockNote, h / 2);

  meter(ctx, sizes.topBarX.credibility, h / 2, 'Credibility', sim.state.C, colors.faction.L.main);
  meter(ctx, sizes.topBarX.fear, h / 2, 'City fear', sim.state.F, colors.fear);
}

function meter(ctx: CanvasRenderingContext2D, x: number, cy: number, label: string, value: number, color: string) {
  ctx.font = `${sizes.numberSize}px ${fonts.sans}`;
  ctx.fillStyle = colors.inkSoft;
  ctx.textAlign = 'left';
  ctx.fillText(`${label} ${Math.round(value)}`, x, cy - 6);
  const w = sizes.meterWidth;
  ctx.fillStyle = colors.barBack;
  ctx.fillRect(x, cy + 3, w, sizes.bar.height + 1);
  ctx.fillStyle = color;
  ctx.fillRect(x, cy + 3, (w * Math.max(0, Math.min(100, value))) / 100, sizes.bar.height + 1);
}

/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { blobRadius, clockLabel, crowdPoint, makeLayout, sizeLabel, stateGlyph } from '../src/render/view';
import { sizes } from '../src/render/theme';
import { crowd, daySim, standing, emptySim, tuning } from './helpers';
import { step } from '../src/sim';

describe('render helpers (milestone 2)', () => {
  it('clock label = 12:00 + t × 1.375 game minutes', () => {
    expect(clockLabel(0, tuning)).toBe('12:00');
    expect(clockLabel(60, tuning)).toBe('13:22');
    expect(clockLabel(196, tuning)).toBe('16:29');
    expect(clockLabel(240, tuning)).toBe('17:30');
  });

  it('confirmed sizes are exact; reported sizes get "~"', () => {
    expect(sizeLabel(8000, false)).toBe('8,000');
    expect(sizeLabel(1000, true)).toBe('~1,000');
  });

  it('blob size grows with crowd size, within limits', () => {
    expect(blobRadius(8000)).toBeGreaterThan(blobRadius(2000));
    expect(blobRadius(10)).toBe(sizes.blobMin);
    expect(blobRadius(1e9)).toBe(sizes.blobMax);
  });

  it('the layout keeps the whole graph inside the canvas, below the top bar', () => {
    const sim = daySim();
    const layout = makeLayout(sim.graph, 1280, 800);
    for (const n of sim.graph.nodes.values()) {
      const p = layout.toScreen(n);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1280);
      expect(p.y).toBeGreaterThan(sizes.topBar);
      expect(p.y).toBeLessThan(800);
    }
  });

  it('a crowd on an edge is drawn part-way along it', () => {
    const sim = emptySim();
    const c = crowd(sim, { size: 3000, origin: 'N1', destination: 'N5' });
    step(sim);
    const p = crowdPoint(sim.graph, c);
    expect(p.x).toBe(4);
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(1);
  });

  it('state glyphs: marching, rallying, panic lock, speaker', () => {
    const sim = emptySim();
    const c = standing(sim, 'N9');
    expect(stateGlyph(c)).toBe('⚑');
    c.state = 'Marching';
    expect(stateGlyph(c)).toBe('➜');
    c.speaker = 'Ledebour';
    expect(stateGlyph(c)).toBe('❝');
    c.state = 'Panicking';
    expect(stateGlyph(c)).toBe('⊘');
  });
});

describe('all colours and fonts live in src/render/theme.ts', () => {
  const sources = import.meta.glob<string>(['../src/render/*.ts', '../src/ui/*.ts', '../src/main.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  for (const [path, source] of Object.entries(sources)) {
    if (path.endsWith('theme.ts')) continue;
    it(path.replace('../', ''), () => {
      expect(source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([]);
      expect(source.match(/['"][^'"\n]*\b(Georgia|Times|Helvetica|Arial|serif|monospace)\b[^'"\n]*['"]/g) ?? []).toEqual([]);
    });
  }
});

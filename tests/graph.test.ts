import { describe, expect, it } from 'vitest';
import { buildGraph, edgeBetween, hopDistance } from '../src/sim';
import { map } from './helpers';

describe('street graph (spec §2)', () => {
  const g = buildGraph(map);

  it('has the 15 nodes and 20 edges of the spec', () => {
    expect(g.nodes.size).toBe(15);
    expect(g.edges.size).toBe(20);
  });

  it('edges are undirected with block lengths and kinds', () => {
    expect(edgeBetween(g, 'N5', 'N1').blocks).toBe(2);
    expect(edgeBetween(g, 'N3', 'N4').kind).toBe('boulevard');
    expect(edgeBetween(g, 'N14', 'N9').kind).toBe('bridge');
    expect(edgeBetween(g, 'N6', 'N7').kind).toBe('square');
  });

  it('hop distances', () => {
    expect(hopDistance(g, 'N4', 'N4')).toBe(0);
    expect(hopDistance(g, 'N4', 'N3')).toBe(1);
    expect(hopDistance(g, 'N1', 'N9')).toBe(4);
  });

  it('holdable buildings are N9, N11, N12, N14', () => {
    expect([...g.nodes.values()].filter((n) => n.holdable).map((n) => n.id)).toEqual(['N9', 'N11', 'N12', 'N14']);
  });
});

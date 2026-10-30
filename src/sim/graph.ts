import type { EdgeId, EdgeKind, NodeId } from './types';

export interface GraphNode {
  id: NodeId;
  name: string;
  x: number;
  y: number;
  weight: number;
  type: string;
  holdable: boolean;
}

export interface GraphEdge {
  id: EdgeId;
  a: NodeId;
  b: NodeId;
  blocks: number;
  kind: EdgeKind;
}

export interface Graph {
  nodes: Map<NodeId, GraphNode>;
  edges: Map<EdgeId, GraphEdge>;
  /** node -> list of { edge, other end } */
  adj: Map<NodeId, { edge: GraphEdge; to: NodeId }[]>;
  /** Hop distance between every pair of nodes. */
  hops: Map<NodeId, Map<NodeId, number>>;
}

/** Shape of src/data/map.json (tests may pass a smaller map of the same shape). */
export interface MapInput {
  nodes: { id: string; name: string; x: number; y: number; weight: number; type: string; holdable?: boolean }[];
  edges: { id: string; a: string; b: string; blocks: number; kind: string }[];
}

export function buildGraph(map: MapInput): Graph {
  const nodes = new Map<NodeId, GraphNode>();
  for (const n of map.nodes) {
    nodes.set(n.id, { ...n, holdable: n.holdable ?? false });
  }
  const edges = new Map<EdgeId, GraphEdge>();
  const adj = new Map<NodeId, { edge: GraphEdge; to: NodeId }[]>();
  for (const id of nodes.keys()) adj.set(id, []);
  for (const e of map.edges as GraphEdge[]) {
    if (!nodes.has(e.a) || !nodes.has(e.b)) throw new Error(`Edge ${e.id} references an unknown node`);
    edges.set(e.id, e);
    adj.get(e.a)!.push({ edge: e, to: e.b });
    adj.get(e.b)!.push({ edge: e, to: e.a });
  }
  const hops = new Map<NodeId, Map<NodeId, number>>();
  for (const src of nodes.keys()) {
    const dist = new Map<NodeId, number>([[src, 0]]);
    const queue = [src];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const { to } of adj.get(cur)!) {
        if (!dist.has(to)) {
          dist.set(to, dist.get(cur)! + 1);
          queue.push(to);
        }
      }
    }
    hops.set(src, dist);
  }
  return { nodes, edges, adj, hops };
}

export function hopDistance(g: Graph, a: NodeId, b: NodeId): number {
  return g.hops.get(a)?.get(b) ?? Infinity;
}

export function edgeBetween(g: Graph, a: NodeId, b: NodeId): GraphEdge {
  const link = g.adj.get(a)?.find((l) => l.to === b);
  if (!link) throw new Error(`No edge between ${a} and ${b}`);
  return link.edge;
}

export function neighbours(g: Graph, n: NodeId): NodeId[] {
  return g.adj.get(n)!.map((l) => l.to);
}

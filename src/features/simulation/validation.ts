import type { FlowEdge, FlowNode } from '../../types/flow';
import { edgeBranch, type Graph } from './engine';

export type Issue = {
  level: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
};

function name(n: FlowNode) {
  return `“${n.data.label || n.type}”`;
}

export function validateFlow({ nodes, edges }: Graph): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const starts = nodes.filter((n) => n.type === 'start');
  const ends = nodes.filter((n) => n.type === 'end');

  if (starts.length === 0) issues.push({ level: 'error', message: 'Add a Start node to begin the flow.' });
  if (starts.length > 1)
    starts.slice(1).forEach((n) =>
      issues.push({ level: 'error', nodeId: n.id, message: `Only one Start node is allowed — remove ${name(n)}.` }),
    );
  if (ends.length === 0) issues.push({ level: 'error', message: 'Add an End node so the flow can finish.' });

  const validEdges: FlowEdge[] = [];
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) {
      issues.push({ level: 'error', edgeId: e.id, message: 'A connection points to a node that no longer exists.' });
    } else validEdges.push(e);
  }

  const outCount = new Map<string, FlowEdge[]>();
  const inCount = new Map<string, number>();
  for (const e of validEdges) {
    outCount.set(e.source, [...(outCount.get(e.source) ?? []), e]);
    inCount.set(e.target, (inCount.get(e.target) ?? 0) + 1);
  }

  for (const s of starts) {
    if (!outCount.get(s.id)?.length)
      issues.push({ level: 'error', nodeId: s.id, message: `${name(s)} has no outgoing connection.` });
    if (inCount.get(s.id))
      issues.push({ level: 'error', nodeId: s.id, message: `${name(s)} cannot receive incoming connections.` });
  }
  for (const n of ends) {
    if (outCount.get(n.id)?.length)
      issues.push({ level: 'error', nodeId: n.id, message: `${name(n)} cannot have outgoing connections.` });
  }

  for (const d of nodes.filter((n) => n.type === 'decision')) {
    const out = outCount.get(d.id) ?? [];
    const branches = new Set(out.map(edgeBranch));
    if (!branches.has('TRUE') || !branches.has('FALSE')) {
      const missing = ['TRUE', 'FALSE'].filter((b) => !branches.has(b as 'TRUE'));
      issues.push({ level: 'error', nodeId: d.id, message: `Decision ${name(d)} is missing its ${missing.join(' and ')} path.` });
    }
  }

  // Reachability from Start (warning only).
  if (starts.length) {
    const seen = new Set<string>([starts[0].id]);
    const queue = [starts[0].id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of outCount.get(id) ?? []) {
        if (!seen.has(e.target)) {
          seen.add(e.target);
          queue.push(e.target);
        }
      }
    }
    for (const n of nodes) {
      if (seen.has(n.id) || n.type === 'start') continue;
      const orphan = !outCount.get(n.id)?.length && !inCount.get(n.id);
      issues.push({
        level: 'warning',
        nodeId: n.id,
        message: orphan ? `${name(n)} is not connected to anything.` : `${name(n)} can never be reached from Start.`,
      });
    }
  }

  return issues;
}

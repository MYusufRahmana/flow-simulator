/**
 * Pure simulation engine. No React, no timers — given a graph and a token it
 * decides what a node does and which edges the token travels next. The runner
 * (runner.ts) adds timing, animation and pause/step control on top.
 */
import type { Branch, FlowEdge, FlowNode, Payload } from '../../types/flow';
import { parsePayload } from '../../utils/misc';

export type Graph = { nodes: FlowNode[]; edges: FlowEdge[] };

export type Token = { nodeId: string; payload: Payload };

export type LogLevel = 'info' | 'success' | 'error' | 'warn';
export type EngineLog = { text: string; level: LogLevel };

export type NodeOutcome = {
  nodeId: string;
  status: 'SUCCESS' | 'FAILED';
  payload: Payload;
  logs: EngineLog[];
  take: FlowEdge[];
  skip: FlowEdge[];
  /** The branch this node resolved to (decision TRUE/FALSE, or SUCCESS/FAILED). */
  branch: Branch;
};

export type PendingDecision = { nodeId: string; needsDecision: true };

export const MAX_STEPS = 500;

export function outgoingEdges(graph: Graph, nodeId: string): FlowEdge[] {
  return graph.edges.filter((e) => e.source === nodeId);
}

function q(label: string) {
  return `“${label}”`;
}

/** Edge branch, falling back to the handle it was drawn from. */
export function edgeBranch(edge: Pick<FlowEdge, 'data' | 'sourceHandle'>): Branch | undefined {
  if (edge.data?.branch) return edge.data.branch;
  if (edge.sourceHandle === 'true') return 'TRUE';
  if (edge.sourceHandle === 'false') return 'FALSE';
  if (edge.sourceHandle === 'fail') return 'FAILED';
  return undefined;
}

/** Decision nodes set to ASK need a choice from the user before they can run. */
export function needsDecision(graph: Graph, nodeId: string, choice?: 'TRUE' | 'FALSE'): boolean {
  const node = graph.nodes.find((n) => n.id === nodeId);
  return !!node && node.type === 'decision' && (node.data.config?.outcome ?? 'TRUE') === 'ASK' && !choice;
}

export function runNode(graph: Graph, token: Token, choice?: 'TRUE' | 'FALSE'): NodeOutcome {
  const node = graph.nodes.find((n) => n.id === token.nodeId);
  if (!node) {
    return {
      nodeId: token.nodeId,
      status: 'FAILED',
      payload: token.payload,
      logs: [{ text: `Node ${token.nodeId} not found`, level: 'error' }],
      take: [],
      skip: [],
      branch: 'FAILED',
    };
  }

  const c = node.data.config ?? {};
  const label = node.data.label || node.type || 'Node';
  const logs: EngineLog[] = [];
  let payload: Payload = { ...token.payload };

  const own = parsePayload(node.data.payload);
  if (own.ok) payload = { ...payload, ...own.value };
  else logs.push({ text: `${q(label)} payload ignored: ${own.error}`, level: 'warn' });

  let failed = !!c.fail;
  let branch: Branch = 'SUCCESS';

  switch (node.type) {
    case 'start':
      logs.push({ text: `Flow started at ${q(label)}`, level: 'info' });
      break;
    case 'input':
      logs.push({ text: `${q(label)} submitted${c.fields ? ` (${c.fields})` : ''}`, level: 'info' });
      break;
    case 'page':
      logs.push({ text: `Rendered ${q(label)}${c.route ? ` at ${c.route}` : ''}`, level: 'info' });
      break;
    case 'api': {
      const status = c.statusCode ?? 200;
      if (status >= 400) failed = true;
      const req = `${c.method ?? 'GET'} ${c.endpoint ?? '/'}`;
      const res = parsePayload(c.response);
      if (!failed && res.ok && Object.keys(res.value).length) payload = { ...payload, response: res.value };
      logs.push({
        text: `${req} → ${failed && !(status >= 400) ? 'request failed' : status}`,
        level: failed ? 'error' : 'info',
      });
      break;
    }
    case 'backend':
      logs.push({ text: `${q(label)}${c.handler ? `::${c.handler}` : ''} handled request`, level: 'info' });
      break;
    case 'database':
      logs.push({
        text: `${c.action ?? 'SELECT'} ${c.table ?? 'table'}${c.database ? ` on ${c.database}` : ''}`,
        level: 'info',
      });
      break;
    case 'external':
      logs.push({ text: `Called external service ${c.service ? q(c.service) : q(label)}`, level: 'info' });
      break;
    case 'notification':
      logs.push({ text: `Sent ${c.channel ?? 'notification'}: ${q(label)}`, level: 'info' });
      break;
    case 'output':
      logs.push({ text: `Output ${q(label)}`, level: 'success' });
      break;
    case 'decision': {
      const outcome = choice ?? (c.outcome === 'FALSE' ? 'FALSE' : 'TRUE');
      branch = outcome;
      logs.push({ text: `${q(label)}${c.condition ? ` [${c.condition}]` : ''} → ${outcome}`, level: 'info' });
      break;
    }
    case 'error':
      failed = true;
      payload = { ...payload, error: { code: c.code ?? null, message: label } };
      logs.push({ text: `Error ${q(label)}${c.code ? ` (${c.code})` : ''}`, level: 'error' });
      break;
    case 'end':
      logs.push({ text: `Reached ${q(label)}`, level: 'success' });
      break;
  }

  if (failed && node.type !== 'error' && node.type !== 'api') {
    logs.push({ text: `${q(label)} failed`, level: 'error' });
  }
  if (failed && node.type !== 'decision') branch = 'FAILED';

  const out = outgoingEdges(graph, node.id);
  let take: FlowEdge[];

  if (node.type === 'end') {
    take = [];
  } else if (node.type === 'error') {
    // An error node is a failure *state*: it continues along whatever follows it.
    take = out;
  } else if (node.type === 'decision') {
    take = out.filter((e) => edgeBranch(e) === branch);
    if (!take.length) logs.push({ text: `No ${branch} path from ${q(label)} — flow stopped`, level: 'warn' });
  } else if (failed) {
    take = out.filter((e) => edgeBranch(e) === 'FAILED');
    if (!take.length) logs.push({ text: `No failure path from ${q(label)} — flow stopped`, level: 'warn' });
  } else {
    take = out.filter((e) => edgeBranch(e) !== 'FAILED');
  }

  const takeIds = new Set(take.map((e) => e.id));
  return {
    nodeId: node.id,
    status: failed ? 'FAILED' : 'SUCCESS',
    payload,
    logs,
    take,
    skip: out.filter((e) => !takeIds.has(e.id)),
    branch,
  };
}

/** Turn the edges a wave travelled into the next wave of tokens (merging tokens that meet). */
export function advance(outcomes: NodeOutcome[]): Token[] {
  const byNode = new Map<string, Token>();
  for (const o of outcomes) {
    for (const e of o.take) {
      const existing = byNode.get(e.target);
      byNode.set(e.target, {
        nodeId: e.target,
        payload: existing ? { ...existing.payload, ...o.payload } : o.payload,
      });
    }
  }
  return [...byNode.values()];
}

export function findStart(graph: Graph): FlowNode | undefined {
  return graph.nodes.find((n) => n.type === 'start');
}

/**
 * Run the whole flow synchronously. Used by tests and for quick path previews.
 * `choices` answers ASK decisions; unanswered ones default to TRUE.
 */
export function simulate(
  graph: Graph,
  choices: Record<string, 'TRUE' | 'FALSE'> = {},
): { visited: string[]; outcomes: NodeOutcome[]; reachedEnd: boolean; steps: number } {
  const start = findStart(graph);
  if (!start) return { visited: [], outcomes: [], reachedEnd: false, steps: 0 };
  let tokens: Token[] = [{ nodeId: start.id, payload: {} }];
  const visited: string[] = [];
  const outcomes: NodeOutcome[] = [];
  let steps = 0;
  while (tokens.length && steps < MAX_STEPS) {
    const wave = tokens.map((t) => runNode(graph, t, choices[t.nodeId] ?? (needsDecision(graph, t.nodeId) ? 'TRUE' : undefined)));
    wave.forEach((o) => visited.push(o.nodeId));
    outcomes.push(...wave);
    tokens = advance(wave);
    steps++;
  }
  const endIds = new Set(graph.nodes.filter((n) => n.type === 'end').map((n) => n.id));
  return { visited, outcomes, reachedEnd: visited.some((id) => endIds.has(id)), steps };
}

import { describe, expect, it } from 'vitest';
import type { Branch, FlowEdge, FlowNode, NodeKind } from '../../types/flow';
import { isFlowchartKind } from '../../components/nodes/registry';
import { TEMPLATES } from '../projects/templates';
import { parseProjectFile, toFile } from '../projects/io';
import { runNode, simulate, type Graph } from './engine';
import { validateFlow } from './validation';

const n = (id: string, type: NodeKind, config: FlowNode['data']['config'] = {}, payload?: string): FlowNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id, config, payload },
});
const e = (source: string, target: string, sourceHandle = 'out', branch?: Branch): FlowEdge => ({
  id: `${source}-${target}`,
  type: 'flow',
  source,
  target,
  sourceHandle,
  data: { branch },
});

function loginGraph(outcome: 'TRUE' | 'FALSE' | 'ASK' = 'TRUE'): Graph {
  return {
    nodes: [n('start', 'start'), n('form', 'input', {}, '{"email":"a@b.c"}'), n('valid', 'decision', { outcome }), n('dash', 'page'), n('err', 'error'), n('end', 'end')],
    edges: [e('start', 'form'), e('form', 'valid'), e('valid', 'dash', 'true'), e('valid', 'err', 'false'), e('dash', 'end'), e('err', 'end')],
  };
}

describe('simulation engine', () => {
  it('traverses a linear flow to End', () => {
    const r = simulate(loginGraph('TRUE'));
    expect(r.visited).toEqual(['start', 'form', 'valid', 'dash', 'end']);
    expect(r.reachedEnd).toBe(true);
  });

  it('decision follows only the configured branch', () => {
    const r = simulate(loginGraph('FALSE'));
    expect(r.visited).toEqual(['start', 'form', 'valid', 'err', 'end']);
    const decision = r.outcomes.find((o) => o.nodeId === 'valid')!;
    expect(decision.take.map((x) => x.target)).toEqual(['err']);
    expect(decision.skip.map((x) => x.target)).toEqual(['dash']);
  });

  it('ASK decisions use the supplied choice', () => {
    expect(simulate(loginGraph('ASK'), { valid: 'FALSE' }).visited).toContain('err');
    expect(simulate(loginGraph('ASK'), { valid: 'TRUE' }).visited).toContain('dash');
  });

  it('carries and merges payload between nodes', () => {
    const r = simulate(loginGraph());
    const end = r.outcomes.find((o) => o.nodeId === 'end')!;
    expect(end.payload).toMatchObject({ email: 'a@b.c' });
  });

  it('failing node follows the FAILED path, or stops when there is none', () => {
    const g: Graph = {
      nodes: [n('start', 'start'), n('api', 'api', { statusCode: 500 }), n('ok', 'output'), n('err', 'error'), n('end', 'end')],
      edges: [e('start', 'api'), e('api', 'ok'), e('api', 'err', 'fail'), e('ok', 'end'), e('err', 'end')],
    };
    expect(simulate(g).visited).toEqual(['start', 'api', 'err', 'end']);
    g.edges = g.edges.filter((x) => x.target !== 'err');
    const r = simulate(g);
    expect(r.visited).toEqual(['start', 'api']);
    expect(r.reachedEnd).toBe(false);
  });

  it('fans out to parallel branches and merges them', () => {
    const g: Graph = {
      nodes: [n('start', 'start'), n('a', 'process'), n('b', 'process'), n('end', 'end')],
      edges: [e('start', 'a'), e('start', 'b'), e('a', 'end'), e('b', 'end')],
    };
    const r = simulate(g);
    expect(r.visited).toEqual(['start', 'a', 'b', 'end']);
  });

  it('stops infinite loops', () => {
    const g: Graph = {
      nodes: [n('start', 'start'), n('a', 'process'), n('b', 'process'), n('end', 'end')],
      edges: [e('start', 'a'), e('a', 'b'), e('b', 'a')],
    };
    expect(simulate(g).steps).toBe(500);
  });

  it('api success adds the response to the payload', () => {
    const g = { nodes: [n('api', 'api', { statusCode: 201, response: '{"id":1}' })], edges: [] };
    expect(runNode(g, { nodeId: 'api', payload: {} }).payload).toEqual({ response: { id: 1 } });
  });

  it('every bundled simulation template is valid and reaches End', () => {
    // Flowchart templates are drawings for presenting, not simulations.
    for (const t of TEMPLATES.filter((t) => !t.kinds.some(isFlowchartKind))) {
      const p = t.build();
      const errors = validateFlow(p).filter((i) => i.level === 'error');
      expect(errors, t.id).toEqual([]);
      expect(simulate(p).reachedEnd, t.id).toBe(true);
    }
  });
});

describe('validation', () => {
  it('reports missing start/end and decision branches', () => {
    const issues = validateFlow({ nodes: [n('d', 'decision')], edges: [] });
    const msgs = issues.map((i) => i.message).join('\n');
    expect(msgs).toMatch(/Start/);
    expect(msgs).toMatch(/End/);
    expect(msgs).toMatch(/TRUE and FALSE/);
  });

  it('flags broken edge references and warns on orphans', () => {
    const g = loginGraph();
    g.nodes.push(n('lonely', 'process'));
    g.edges.push(e('form', 'ghost'));
    const issues = validateFlow(g);
    expect(issues.some((i) => i.level === 'error' && /no longer exists/.test(i.message))).toBe(true);
    expect(issues.some((i) => i.level === 'warning' && i.nodeId === 'lonely')).toBe(true);
  });
});

describe('import / export', () => {
  it('round-trips a project', () => {
    const p = TEMPLATES[0].build();
    const back = parseProjectFile(JSON.stringify(toFile(p)));
    expect(back.name).toBe(p.name);
    expect(back.nodes).toHaveLength(p.nodes.length);
    expect(back.edges).toHaveLength(p.edges.length);
    expect(back.id).not.toBe(p.id);
  });

  it.each([
    ['not json', 'oops'],
    ['missing project', '{"version":1}'],
    ['unknown node type', '{"version":1,"project":{"name":"x","nodes":[{"id":"a","type":"rocket","position":{"x":0,"y":0},"data":{"label":"a"}}],"edges":[]}}'],
    ['broken edge', '{"version":1,"project":{"name":"x","nodes":[],"edges":[{"id":"e","source":"a","target":"b"}]}}'],
    ['future version', '{"version":99,"project":{"name":"x","nodes":[],"edges":[]}}'],
  ])('rejects %s', (_, text) => {
    expect(() => parseProjectFile(text)).toThrow();
  });
});

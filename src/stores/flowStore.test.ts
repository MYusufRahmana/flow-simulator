import { beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATES } from '../features/projects/templates';
import { useFlowStore } from './flowStore';

const flow = () => useFlowStore.getState();

describe('select all / copy / paste / delete all', () => {
  beforeEach(() => flow().load(TEMPLATES[0].build()));

  it('selects every node and edge', () => {
    flow().selectAll();
    expect(flow().nodes.every((n) => n.selected)).toBe(true);
    expect(flow().selectedNodeIds).toHaveLength(flow().nodes.length);
    expect(flow().selectedEdgeIds).toHaveLength(flow().edges.length);
  });

  it('copies everything when nothing is selected, and paste adds fresh copies with remapped edges', () => {
    const before = { nodes: flow().nodes.length, edges: flow().edges.length };
    expect(flow().copySelection()).toBe(before.nodes);
    expect(flow().paste()).toBe(before.nodes);

    const { nodes, edges } = flow();
    expect(nodes).toHaveLength(before.nodes * 2);
    expect(edges).toHaveLength(before.edges * 2);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    const ids = new Set(nodes.map((n) => n.id));
    expect(edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
    // Only the pasted nodes end up selected.
    expect(nodes.filter((n) => n.selected)).toHaveLength(before.nodes);
  });

  it('copies only the selection and keeps only edges inside it', () => {
    flow().selectNode('api');
    expect(flow().copySelection()).toBe(1);
    flow().paste();
    expect(flow().edges).toHaveLength(TEMPLATES[0].build().edges.length);
  });

  it('cut removes the selection but keeps it on the clipboard', () => {
    flow().selectNode('dash');
    expect(flow().cutSelection()).toBe(1);
    expect(flow().nodes.some((n) => n.id === 'dash')).toBe(false);
    expect(flow().paste()).toBe(1);
  });

  it('delete all empties the canvas and undo brings it back', () => {
    const count = flow().nodes.length;
    expect(flow().deleteAll()).toBe(count);
    expect(flow().nodes).toHaveLength(0);
    expect(flow().edges).toHaveLength(0);
    flow().undo();
    expect(flow().nodes).toHaveLength(count);
  });
});

describe('change node type keeps lines on real handles', () => {
  beforeEach(() => flow().load(TEMPLATES[0].build()));

  it('decision -> process moves TRUE onto the main path and FALSE onto the failure path', () => {
    flow().changeNodeType('valid', 'process');
    const out = flow().edges.filter((e) => e.source === 'valid');
    expect(out.map((e) => e.sourceHandle).sort()).toEqual(['fail', 'out']);
    expect(out.find((e) => e.sourceHandle === 'out')?.data?.branch).toBeUndefined();
    expect(out.find((e) => e.sourceHandle === 'fail')?.data?.branch).toBe('FAILED');
  });

  it('end -> process moves a right-side entry back to the top', () => {
    flow().changeNodeType('end', 'process');
    const into = flow().edges.filter((e) => e.target === 'end');
    expect(into.every((e) => e.targetHandle === 'top' || e.targetHandle === 'left')).toBe(true);
  });
});

describe('flowchart shapes', () => {
  beforeEach(() => flow().load(TEMPLATES.find((t) => t.id === 'flowchart-cuti')!.build()));

  it('decision -> process -> decision keeps both branches with Ya / Tidak labels', () => {
    flow().changeNodeType('ok', 'fc-process');
    expect(flow().edges.filter((e) => e.source === 'ok').map((e) => e.sourceHandle).sort()).toEqual(['out', 'out-right']);
    flow().changeNodeType('ok', 'fc-decision');
    const out = flow().edges.filter((e) => e.source === 'ok');
    expect(out.map((e) => e.data?.label).sort()).toEqual(['Tidak', 'Ya']);
  });

  it('turning a connected shape into Text drops its lines', () => {
    flow().changeNodeType('cek', 'fc-text');
    expect(flow().edges.some((e) => e.source === 'cek' || e.target === 'cek')).toBe(false);
  });

  it('reverses an edge', () => {
    const edge = flow().edges.find((e) => e.source === 'form' && e.target === 'cek')!;
    flow().reverseEdge(edge.id);
    const reversed = flow().edges.find((e) => e.id === edge.id)!;
    expect([reversed.source, reversed.target]).toEqual(['cek', 'form']);
  });

  it('paste at a point puts the copy there (within half a grid cell)', () => {
    flow().selectNode('mulai');
    flow().copySelection();
    flow().paste({ x: 1000, y: 500 });
    const pasted = flow().nodes.find((n) => n.selected)!;
    expect(Math.abs(pasted.position.x - 1000)).toBeLessThanOrEqual(6);
    expect(Math.abs(pasted.position.y - 500)).toBeLessThanOrEqual(6);
  });
});

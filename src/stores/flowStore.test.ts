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

import {
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';
import { NODE_META } from '../components/nodes/registry';
import type {
  Branch,
  FlowEdge,
  FlowEdgeData,
  FlowNode,
  FlowNodeData,
  FlowProject,
  NodeKind,
  Viewport,
} from '../types/flow';
import { prefs } from '../db/indexedDb';
import { AUTO_HANDLE, pickTargetHandle } from '../features/editor/connect';
import { cleanEdges, cleanNodes, uid } from '../utils/misc';

type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[] };
export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;

type FlowState = {
  project: FlowProject | null;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: Viewport;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  past: Snapshot[];
  future: Snapshot[];
  saveState: SaveState;
  /** Increments on every document change; autosave watches it. */
  revision: number;

  load: (project: FlowProject) => void;
  unload: () => void;
  toProject: () => FlowProject | null;
  setName: (name: string) => void;
  setViewport: (vp: Viewport) => void;
  setSaveState: (s: SaveState) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  clearSelection: () => void;
  selectNode: (id: string) => void;

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (c: Connection) => void;

  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  /** Create a node and connect it from an existing handle in one undo step. */
  addConnectedNode: (kind: NodeKind, position: { x: number; y: number }, source: string, sourceHandle: string | null) => string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  updateNodeConfig: (id: string, patch: NonNullable<FlowNodeData['config']>) => void;
  changeNodeType: (id: string, kind: NodeKind) => void;
  updateEdgeData: (id: string, patch: Partial<FlowEdgeData>) => void;
  deleteSelection: () => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  duplicateSelection: () => void;
  /** Number of nodes on the clipboard (0 = nothing to paste). */
  clipboardCount: number;
  selectAll: () => void;
  /** Copies the selection, or the whole diagram when nothing is selected. Returns the node count. */
  copySelection: () => number;
  cutSelection: () => number;
  paste: () => number;
  deleteAll: () => number;

  pushHistory: (coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
};

let lastHistory = { key: '', at: 0 };

type Clipboard = { nodes: FlowNode[]; edges: FlowEdge[] };
const CLIPBOARD_KEY = 'clipboard';
// Kept in localStorage so copied components can be pasted into another project or tab.
let clipboard: Clipboard | null = prefs.get<Clipboard | null>(CLIPBOARD_KEY, null);
let pasteCount = 0;

/** Fresh copies of `picked` (new ids, offset, selected) plus the edges that run between them. */
function cloneNodes(picked: FlowNode[], edges: FlowEdge[], offset: number) {
  const idMap = new Map<string, string>();
  const nodes = picked.map((n) => {
    const id = uid(n.type ?? 'node');
    idMap.set(n.id, id);
    return {
      id,
      type: n.type,
      position: { x: n.position.x + offset, y: n.position.y + offset },
      data: structuredClone(n.data),
      selected: true,
    } as FlowNode;
  });
  const copiedEdges = edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({ ...e, id: uid('e'), source: idMap.get(e.source)!, target: idMap.get(e.target)!, selected: false }));
  return { nodes, edges: copiedEdges };
}

function branchForHandle(sourceKind: NodeKind | undefined, handle: string | null | undefined): Branch | undefined {
  if (sourceKind === 'decision') return handle === 'false' ? 'FALSE' : 'TRUE';
  if (handle === 'fail') return 'FAILED';
  return undefined;
}

export const useFlowStore = create<FlowState>((set, get) => {
  const changed = (partial: Partial<FlowState>) =>
    set((s) => ({ ...partial, saveState: 'unsaved', revision: s.revision + 1 }));

  return {
    project: null,
    name: '',
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    past: [],
    future: [],
    saveState: 'saved',
    revision: 0,

    load: (project) => {
      lastHistory = { key: '', at: 0 };
      set({
        project,
        name: project.name,
        nodes: project.nodes.map((n) => ({ ...n, selected: false })),
        edges: project.edges.map((e) => ({ ...e, type: 'flow', selected: false })),
        viewport: project.viewport,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        past: [],
        future: [],
        saveState: 'saved',
        revision: 0,
      });
    },
    unload: () => set({ project: null, nodes: [], edges: [], past: [], future: [] }),

    toProject: () => {
      const { project, name, nodes, edges, viewport } = get();
      if (!project) return null;
      return {
        ...project,
        name: name.trim() || 'Untitled flow',
        nodes: cleanNodes(nodes),
        edges: cleanEdges(edges),
        viewport,
      };
    },

    setName: (name) => changed({ name }),
    setViewport: (viewport) => set({ viewport }),
    setSaveState: (saveState) => set({ saveState }),
    setSelection: (selectedNodeIds, selectedEdgeIds) => set({ selectedNodeIds, selectedEdgeIds }),
    clearSelection: () =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
        selectedNodeIds: [],
        selectedEdgeIds: [],
      })),
    selectNode: (id) =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.selected !== (n.id === id) ? { ...n, selected: n.id === id } : n)),
        edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
        selectedNodeIds: [id],
        selectedEdgeIds: [],
      })),

    onNodesChange: (changes) => {
      const nodes = applyNodeChanges(changes, get().nodes);
      const meaningful = changes.some((c) => c.type === 'position' || c.type === 'remove' || c.type === 'add');
      if (meaningful) changed({ nodes });
      else set({ nodes });
    },
    onEdgesChange: (changes) => {
      const edges = applyEdgeChanges(changes, get().edges);
      if (changes.some((c) => c.type === 'remove' || c.type === 'add')) changed({ edges });
      else set({ edges });
    },
    onConnect: (c) => {
      const { nodes, edges, pushHistory } = get();
      const source = nodes.find((n) => n.id === c.source);
      const target = nodes.find((n) => n.id === c.target);
      const branch = branchForHandle(source?.type, c.sourceHandle);
      const targetHandle =
        c.targetHandle === AUTO_HANDLE && source && target ? pickTargetHandle(source, c.sourceHandle, target) : c.targetHandle;
      pushHistory();
      const edge: FlowEdge = {
        ...c,
        targetHandle,
        id: uid('e'),
        type: 'flow',
        data: { branch, label: branch ? branch.toLowerCase() : undefined },
      };
      changed({ edges: rfAddEdge(edge, edges) as FlowEdge[] });
    },

    addNode: (kind, position) => {
      get().pushHistory();
      const id = uid(kind);
      const node: FlowNode = {
        id,
        type: kind,
        position,
        data: NODE_META[kind].defaults(),
        selected: true,
      };
      changed({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), node] });
      set({ selectedNodeIds: [id], selectedEdgeIds: [] });
      return id;
    },

    addConnectedNode: (kind, position, source, sourceHandle) => {
      get().pushHistory();
      const { nodes, edges } = get();
      const from = nodes.find((n) => n.id === source);
      const id = uid(kind);
      const node: FlowNode = { id, type: kind, position, data: NODE_META[kind].defaults(), selected: true };
      const branch = branchForHandle(from?.type, sourceHandle);
      const edge: FlowEdge = {
        id: uid('e'),
        type: 'flow',
        source,
        sourceHandle,
        target: id,
        targetHandle: from ? pickTargetHandle(from, sourceHandle, node) : 'top',
        data: { branch, label: branch ? branch.toLowerCase() : undefined },
      };
      changed({
        nodes: [...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node],
        edges: [...edges.map((e) => (e.selected ? { ...e, selected: false } : e)), edge],
      });
      set({ selectedNodeIds: [id], selectedEdgeIds: [] });
      return id;
    },

    updateNodeData: (id, patch) => {
      get().pushHistory(`node:${id}:${Object.keys(patch).join(',')}`);
      changed({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) });
    },
    updateNodeConfig: (id, patch) => {
      get().pushHistory(`cfg:${id}:${Object.keys(patch).join(',')}`);
      changed({
        nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n)),
      });
    },
    changeNodeType: (id, kind) => {
      get().pushHistory();
      const defaults = NODE_META[kind].defaults();
      changed({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, type: kind, data: { ...defaults, label: n.data.label, description: n.data.description, payload: n.data.payload } } : n,
        ),
        // Handles differ per type; drop edges that would now be invalid.
        edges: get().edges.filter(
          (e) => !((kind === 'start' && e.target === id) || (kind === 'end' && e.source === id)),
        ),
      });
    },
    updateEdgeData: (id, patch) => {
      get().pushHistory(`edge:${id}:${Object.keys(patch).join(',')}`);
      changed({ edges: get().edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e)) });
    },

    deleteNode: (id) => {
      get().pushHistory();
      changed({
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      });
      set({ selectedNodeIds: [], selectedEdgeIds: [] });
    },
    deleteEdge: (id) => {
      get().pushHistory();
      changed({ edges: get().edges.filter((e) => e.id !== id) });
      set({ selectedEdgeIds: [] });
    },
    deleteSelection: () => {
      const { nodes, edges } = get();
      const nodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      const edgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));
      if (!nodeIds.size && !edgeIds.size) return;
      get().pushHistory();
      changed({
        nodes: nodes.filter((n) => !nodeIds.has(n.id)),
        edges: edges.filter((e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target)),
      });
      set({ selectedNodeIds: [], selectedEdgeIds: [] });
    },
    duplicateSelection: () => {
      const { nodes, edges } = get();
      const picked = nodes.filter((n) => n.selected);
      if (!picked.length) return;
      get().pushHistory();
      const copy = cloneNodes(picked, edges, 40);
      changed({
        nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...copy.nodes],
        edges: [...edges, ...copy.edges],
      });
      set({ selectedNodeIds: copy.nodes.map((c) => c.id), selectedEdgeIds: [] });
    },

    clipboardCount: clipboard?.nodes.length ?? 0,
    selectAll: () =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.selected ? n : { ...n, selected: true })),
        edges: s.edges.map((e) => (e.selected ? e : { ...e, selected: true })),
        selectedNodeIds: s.nodes.map((n) => n.id),
        selectedEdgeIds: s.edges.map((e) => e.id),
      })),
    copySelection: () => {
      const { nodes, edges } = get();
      const selected = nodes.filter((n) => n.selected);
      const picked = selected.length ? selected : nodes;
      if (!picked.length) return 0;
      const ids = new Set(picked.map((n) => n.id));
      clipboard = {
        nodes: cleanNodes(picked),
        edges: cleanEdges(edges.filter((e) => ids.has(e.source) && ids.has(e.target))),
      };
      pasteCount = 0;
      prefs.set(CLIPBOARD_KEY, clipboard);
      set({ clipboardCount: picked.length });
      return picked.length;
    },
    cutSelection: () => {
      if (!get().nodes.some((n) => n.selected)) return 0;
      const count = get().copySelection();
      get().deleteSelection();
      return count;
    },
    paste: () => {
      if (!clipboard?.nodes.length) return 0;
      const { nodes, edges } = get();
      get().pushHistory();
      pasteCount++;
      const copy = cloneNodes(clipboard.nodes, clipboard.edges, 40 * pasteCount);
      changed({
        nodes: [...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...copy.nodes],
        edges: [...edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...copy.edges],
      });
      set({ selectedNodeIds: copy.nodes.map((c) => c.id), selectedEdgeIds: [] });
      return copy.nodes.length;
    },
    deleteAll: () => {
      const count = get().nodes.length;
      if (!count && !get().edges.length) return 0;
      get().pushHistory();
      changed({ nodes: [], edges: [] });
      set({ selectedNodeIds: [], selectedEdgeIds: [] });
      return count;
    },

    pushHistory: (coalesceKey) => {
      const now = Date.now();
      if (coalesceKey && lastHistory.key === coalesceKey && now - lastHistory.at < COALESCE_MS) {
        lastHistory.at = now;
        return;
      }
      lastHistory = { key: coalesceKey ?? '', at: now };
      const { nodes, edges, past } = get();
      set({
        past: [...past.slice(-HISTORY_LIMIT + 1), { nodes: cleanNodes(nodes), edges: cleanEdges(edges) }],
        future: [],
      });
    },
    undo: () => {
      const { past, future, nodes, edges } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      lastHistory = { key: '', at: 0 };
      changed({
        nodes: prev.nodes,
        edges: prev.edges,
        past: past.slice(0, -1),
        future: [{ nodes: cleanNodes(nodes), edges: cleanEdges(edges) }, ...future],
      });
      set({ selectedNodeIds: [], selectedEdgeIds: [] });
    },
    redo: () => {
      const { past, future, nodes, edges } = get();
      const next = future[0];
      if (!next) return;
      lastHistory = { key: '', at: 0 };
      changed({
        nodes: next.nodes,
        edges: next.edges,
        past: [...past, { nodes: cleanNodes(nodes), edges: cleanEdges(edges) }],
        future: future.slice(1),
      });
      set({ selectedNodeIds: [], selectedEdgeIds: [] });
    },
  };
});

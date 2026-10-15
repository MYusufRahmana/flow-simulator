import {
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';
import { FLOWCHART_SIZE, NODE_META } from '../components/nodes/registry';
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
  selectEdge: (id: string) => void;

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (c: Connection) => void;

  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  /** Create a node and connect it from an existing handle in one undo step. */
  addConnectedNode: (kind: NodeKind, position: { x: number; y: number }, source: string, sourceHandle: string | null) => string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  updateNodeConfig: (id: string, patch: NonNullable<FlowNodeData['config']>) => void;
  /** Same patch on several nodes, as one undo step. */
  updateNodesConfig: (ids: string[], patch: NonNullable<FlowNodeData['config']>) => void;
  changeNodeType: (id: string, kind: NodeKind) => void;
  updateEdgeData: (id: string, patch: Partial<FlowEdgeData>) => void;
  deleteSelection: () => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  duplicateSelection: () => void;
  /** Line selected nodes up on one row (centres level) or one column (centres stacked). */
  alignSelection: (axis: 'row' | 'column') => void;
  /** Number of nodes on the clipboard (0 = nothing to paste). */
  clipboardCount: number;
  selectAll: () => void;
  /** Copies the selection, or the whole diagram when nothing is selected. Returns the node count. */
  copySelection: () => number;
  cutSelection: () => number;
  /** Paste the clipboard; with `at`, its top-left corner lands on that flow position. */
  paste: (at?: { x: number; y: number }) => number;
  /** Swap an edge's direction (source <-> target). */
  reverseEdge: (id: string) => void;
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
  if (sourceKind === 'decision' || sourceKind === 'fc-decision') return handle === 'false' ? 'FALSE' : 'TRUE';
  if (handle === 'fail') return 'FAILED';
  return undefined;
}

/** Default edge data for a new connection; flowchart decisions read "Ya" / "Tidak" for presenting. */
function edgeDataFor(sourceKind: NodeKind | undefined, handle: string | null | undefined): FlowEdgeData {
  const branch = branchForHandle(sourceKind, handle);
  if (sourceKind === 'fc-decision') return { branch, label: branch === 'FALSE' ? 'Tidak' : 'Ya' };
  return { branch, label: branch ? branch.toLowerCase() : undefined };
}

/** Handles each node kind renders; the first source handle is the main path, the second the side path. */
function sourceHandlesOf(kind: NodeKind): string[] {
  if (kind === 'end' || kind === 'fc-text') return [];
  if (kind === 'decision' || kind === 'fc-decision') return ['true', 'false'];
  if (NODE_META[kind].category === 'flowchart') return ['out', 'out-right'];
  return NODE_META[kind].canFail ? ['out', 'fail'] : ['out'];
}
function targetHandlesOf(kind: NodeKind): string[] {
  if (kind === 'start' || kind === 'fc-text') return [];
  if (kind === 'end' || NODE_META[kind].category === 'flowchart') return ['top', 'left', 'right'];
  return ['top', 'left'];
}
const MAIN_PATH = new Set(['out', 'true']);
/** Labels the app writes itself; anything else was typed by the user and is kept. */
const DEFAULT_LABELS = new Set(['true', 'false', 'failed', 'success', 'Ya', 'Tidak']);

/**
 * Move a node's lines onto the handles of its new kind (main path -> main path, side path -> side path),
 * or drop them when the new kind has no handle on that side.
 */
function retargetEdges(edges: FlowEdge[], id: string, kind: NodeKind): FlowEdge[] {
  const sources = sourceHandlesOf(kind);
  const targets = targetHandlesOf(kind);
  const out: FlowEdge[] = [];
  for (const e of edges) {
    let next = e;
    if (e.source === id) {
      if (!sources.length) continue;
      const handle = e.sourceHandle ?? 'out';
      const mapped = sources.includes(handle) ? handle : MAIN_PATH.has(handle) ? sources[0] : (sources[1] ?? sources[0]);
      if (mapped !== handle) {
        const defaults = edgeDataFor(kind, mapped);
        const custom = e.data?.label && !DEFAULT_LABELS.has(e.data.label) ? e.data.label : undefined;
        next = { ...next, sourceHandle: mapped, data: { ...e.data, ...defaults, label: custom ?? defaults.label } };
      }
    }
    if (e.target === id) {
      if (!targets.length) continue;
      if (!targets.includes(e.targetHandle ?? '')) next = { ...next, targetHandle: 'top' };
    }
    out.push(next);
  }
  return out;
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

    selectEdge: (id) =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        edges: s.edges.map((e) => (e.selected !== (e.id === id) ? { ...e, selected: e.id === id } : e)),
        selectedNodeIds: [],
        selectedEdgeIds: [id],
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
      const targetHandle =
        c.targetHandle === AUTO_HANDLE && source && target ? pickTargetHandle(source, c.sourceHandle, target) : c.targetHandle;
      pushHistory();
      const edge: FlowEdge = {
        ...c,
        targetHandle,
        id: uid('e'),
        type: 'flow',
        data: edgeDataFor(source?.type, c.sourceHandle),
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
      const edge: FlowEdge = {
        id: uid('e'),
        type: 'flow',
        source,
        sourceHandle,
        target: id,
        targetHandle: from ? pickTargetHandle(from, sourceHandle, node) : 'top',
        data: edgeDataFor(from?.type, sourceHandle),
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
    updateNodesConfig: (ids, patch) => {
      const picked = new Set(ids);
      get().pushHistory();
      changed({
        nodes: get().nodes.map((n) => (picked.has(n.id) ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n)),
      });
    },
    changeNodeType: (id, kind) => {
      get().pushHistory();
      const defaults = NODE_META[kind].defaults();
      changed({
        nodes: get().nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                type: kind,
                data: {
                  ...defaults,
                  label: n.data.label,
                  description: n.data.description,
                  payload: n.data.payload,
                  ...(n.data.config?.color ? { config: { ...defaults.config, color: n.data.config.color } } : {}),
                },
              }
            : n,
        ),
        // Handles differ per type: move lines onto the new handles, or drop them when there is none.
        edges: retargetEdges(get().edges, id, kind),
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
    alignSelection: (axis) => {
      const selected = get().nodes.filter((n) => n.selected);
      if (selected.length < 2) return;
      const size = (n: FlowNode) => {
        const fc = FLOWCHART_SIZE[n.type];
        return { w: n.measured?.width ?? fc?.w ?? 232, h: n.measured?.height ?? fc?.h ?? 60 };
      };
      // Align to the first node in reading order: leftmost for a row, topmost for a column.
      const anchor = [...selected].sort((a, b) => (axis === 'row' ? a.position.x - b.position.x : a.position.y - b.position.y))[0];
      const centre = axis === 'row' ? anchor.position.y + size(anchor).h / 2 : anchor.position.x + size(anchor).w / 2;
      get().pushHistory();
      changed({
        nodes: get().nodes.map((n) => {
          if (!n.selected) return n;
          const { w, h } = size(n);
          return {
            ...n,
            position: axis === 'row' ? { x: n.position.x, y: Math.round(centre - h / 2) } : { x: Math.round(centre - w / 2), y: n.position.y },
          };
        }),
      });
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
    paste: (at) => {
      if (!clipboard?.nodes.length) return 0;
      const { nodes, edges } = get();
      get().pushHistory();
      pasteCount++;
      const copy = cloneNodes(clipboard.nodes, clipboard.edges, at ? 0 : 40 * pasteCount);
      if (at) {
        const minX = Math.min(...copy.nodes.map((n) => n.position.x));
        const minY = Math.min(...copy.nodes.map((n) => n.position.y));
        const dx = Math.round((at.x - minX) / 12) * 12;
        const dy = Math.round((at.y - minY) / 12) * 12;
        copy.nodes = copy.nodes.map((n) => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }));
      }
      changed({
        nodes: [...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...copy.nodes],
        edges: [...edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...copy.edges],
      });
      set({ selectedNodeIds: copy.nodes.map((c) => c.id), selectedEdgeIds: [] });
      return copy.nodes.length;
    },
    reverseEdge: (id) => {
      const { nodes, edges } = get();
      const edge = edges.find((e) => e.id === id);
      if (!edge) return;
      const from = nodes.find((n) => n.id === edge.target);
      const to = nodes.find((n) => n.id === edge.source);
      if (!from || !to || to.type === 'start' || from.type === 'end') return;
      get().pushHistory();
      // The new source leaves from its bottom; the new target is entered on the side that reads best.
      const sourceHandle = from.type === 'decision' || from.type === 'fc-decision' ? 'true' : 'out';
      changed({
        edges: edges.map((e) =>
          e.id === id
            ? {
                ...e,
                source: from.id,
                target: to.id,
                sourceHandle,
                targetHandle: pickTargetHandle(from, sourceHandle, to),
                data: { ...e.data, ...edgeDataFor(from.type, sourceHandle), label: e.data?.label },
              }
            : e,
        ),
      });
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

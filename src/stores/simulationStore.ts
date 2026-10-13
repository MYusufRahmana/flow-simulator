/**
 * Simulation runtime: timing, pause/step control and runtime status.
 * The decision logic itself lives in features/simulation/engine.ts.
 * Nothing here is persisted or put into undo history.
 */
import { create } from 'zustand';
import { prefs } from '../db/indexedDb';
import {
  advance,
  findStart,
  MAX_STEPS,
  needsDecision,
  runNode,
  type Graph,
  type LogLevel,
  type NodeOutcome,
  type Token,
} from '../features/simulation/engine';
import { validateFlow, type Issue } from '../features/simulation/validation';
import type { EdgeRunStatus, NodeRunStatus, Payload } from '../types/flow';
import { useFlowStore } from './flowStore';

export type SimStatus = 'idle' | 'running' | 'paused' | 'awaiting' | 'completed' | 'stopped';
export type SimMode = 'auto' | 'step';
export type LogEntry = { id: number; t: number; text: string; level: LogLevel; nodeId?: string };

export const SPEEDS = [0.5, 1, 2, 4] as const;
const EDGE_MS = 900;

type SimState = {
  active: boolean;
  status: SimStatus;
  mode: SimMode;
  speed: number;
  follow: boolean;
  clock: number;
  steps: number;
  /** True when any node failed during the run (e.g. the flow ended via an error path). */
  hadFailure: boolean;
  nodeStatus: Record<string, NodeRunStatus>;
  edgeStatus: Record<string, EdgeRunStatus>;
  /** 0..1 progress of tokens on ACTIVE edges. */
  progress: number;
  edgePayload: Record<string, Payload>;
  currentNodeIds: string[];
  currentPayload: Payload | null;
  payloadByNode: Record<string, Payload>;
  pendingDecision: string | null;
  logs: LogEntry[];
  issues: Issue[] | null;

  start: () => boolean;
  exit: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  restart: () => void;
  choose: (branch: 'TRUE' | 'FALSE') => void;
  setSpeed: (speed: number) => void;
  setMode: (mode: SimMode) => void;
  toggleFollow: () => void;
  dismissIssues: () => void;
};

// ---- runner internals (not reactive) ----
let generation = 0;
let graph: Graph = { nodes: [], edges: [] };
let tokens: Token[] = [];
let pauseAtGate = false;
let releaseGate: (() => void) | null = null;
let resolveDecision: ((b: 'TRUE' | 'FALSE') => void) | null = null;
let logSeq = 0;
let reachedEnd = false;

const runtimeReset = () => ({
  clock: 0,
  steps: 0,
  hadFailure: false,
  nodeStatus: {},
  edgeStatus: {},
  progress: 0,
  edgePayload: {},
  currentNodeIds: [],
  currentPayload: null,
  payloadByNode: {},
  pendingDecision: null,
  logs: [],
});

export const useSimulationStore = create<SimState>((set, get) => {
  const log = (text: string, level: LogLevel = 'info', nodeId?: string) =>
    set((s) => ({ logs: [...s.logs.slice(-999), { id: ++logSeq, t: s.clock, text, level, nodeId }] }));

  /** Wait `ms` of simulated time. Only advances while running, scaled by speed. */
  const wait = (ms: number, gen: number, onProgress?: (p: number) => void) =>
    new Promise<boolean>((resolve) => {
      let elapsed = 0;
      let last = performance.now();
      const frame = (now: number) => {
        if (gen !== generation) return resolve(false);
        const dt = Math.min(100, now - last);
        last = now;
        const { status, speed } = get();
        if (status === 'running') {
          const step = dt * speed;
          elapsed += step;
          set((s) => ({ clock: s.clock + step }));
        }
        const p = ms <= 0 ? 1 : Math.min(1, elapsed / ms);
        onProgress?.(p);
        if (p >= 1) return resolve(true);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

  const finish = () => {
    const status: SimStatus = reachedEnd ? 'completed' : 'stopped';
    set({ status, currentNodeIds: [] });
    if (reachedEnd && get().hadFailure) log(`Flow reached End through an error path (${get().steps} steps)`, 'warn');
    else if (reachedEnd) log(`Simulation completed in ${get().steps} steps`, 'success');
    else log('Simulation stopped before reaching End', 'warn');
  };

  const loop = async (gen: number) => {
    while (gen === generation) {
      if (!tokens.length) return finish();

      // 1. Node phase — every token's node processes in parallel.
      const ids = tokens.map((t) => t.nodeId);
      set((s) => ({
        currentNodeIds: ids,
        currentPayload: tokens[0].payload,
        nodeStatus: { ...s.nodeStatus, ...Object.fromEntries(ids.map((id) => [id, 'PROCESSING' as const])) },
      }));
      const duration = Math.max(
        ...ids.map((id) => graph.nodes.find((n) => n.id === id)?.data.duration ?? 500),
      );
      if (!(await wait(duration, gen))) return;

      const outcomes: NodeOutcome[] = [];
      for (const token of tokens) {
        let choice: 'TRUE' | 'FALSE' | undefined;
        if (needsDecision(graph, token.nodeId)) {
          const label = graph.nodes.find((n) => n.id === token.nodeId)?.data.label;
          set({ status: 'awaiting', pendingDecision: token.nodeId });
          log(`Waiting for your decision on “${label}”`, 'warn', token.nodeId);
          choice = await new Promise<'TRUE' | 'FALSE'>((r) => (resolveDecision = r));
          resolveDecision = null;
          if (gen !== generation) return;
          set({ status: 'running', pendingDecision: null });
        }
        outcomes.push(runNode(graph, token, choice));
      }

      const nodeStatus = { ...get().nodeStatus };
      const edgeStatus = { ...get().edgeStatus };
      const payloadByNode = { ...get().payloadByNode };
      for (const o of outcomes) {
        nodeStatus[o.nodeId] = o.status;
        payloadByNode[o.nodeId] = o.payload;
        o.logs.forEach((l) => log(l.text, l.level, o.nodeId));
        for (const e of o.skip) if (!edgeStatus[e.id] || edgeStatus[e.id] === 'IDLE') edgeStatus[e.id] = 'SKIPPED';
        if (graph.nodes.find((n) => n.id === o.nodeId)?.type === 'end') reachedEnd = true;
      }
      set((s) => ({
        nodeStatus,
        edgeStatus,
        payloadByNode,
        currentPayload: outcomes[0]?.payload ?? null,
        hadFailure: s.hadFailure || outcomes.some((o) => o.status === 'FAILED'),
      }));

      // 2. Edge phase — animate tokens along the chosen connections.
      const travel = outcomes.flatMap((o) => o.take.map((e) => ({ edge: e, outcome: o })));
      const nextTokens = advance(outcomes);
      if (travel.length) {
        set((s) => ({
          progress: 0,
          edgeStatus: { ...s.edgeStatus, ...Object.fromEntries(travel.map(({ edge }) => [edge.id, 'ACTIVE' as const])) },
          edgePayload: Object.fromEntries(travel.map(({ edge, outcome }) => [edge.id, outcome.payload])),
        }));
        for (const { edge } of travel) {
          const target = graph.nodes.find((n) => n.id === edge.target);
          log(`Moving to “${target?.data.label}”${edge.data?.label ? ` via ${edge.data.label}` : ''}`, 'info', edge.target);
        }
        if (!(await wait(EDGE_MS, gen, (progress) => set({ progress })))) return;
        set((s) => ({
          edgeStatus: {
            ...s.edgeStatus,
            ...Object.fromEntries(
              travel.map(({ edge, outcome }) => [edge.id, outcome.status === 'FAILED' ? ('FAILED' as const) : ('SUCCESS' as const)]),
            ),
          },
          edgePayload: {},
        }));
      }

      tokens = nextTokens;
      set((s) => ({ steps: s.steps + 1 }));
      if (get().steps >= MAX_STEPS) {
        log(`Stopped after ${MAX_STEPS} steps — the flow may loop forever`, 'error');
        tokens = [];
      }

      // 3. Gate — step mode (or a "Next" press) pauses between steps.
      if (pauseAtGate && tokens.length) {
        set({ status: 'paused' });
        await new Promise<void>((r) => (releaseGate = r));
        releaseGate = null;
        if (gen !== generation) return;
      }
    }
  };

  const begin = (stepOnly: boolean) => {
    const flow = useFlowStore.getState();
    graph = { nodes: flow.nodes, edges: flow.edges };
    const start = findStart(graph);
    if (!start) return;
    generation++;
    tokens = [{ nodeId: start.id, payload: {} }];
    reachedEnd = false;
    pauseAtGate = stepOnly;
    set({ ...runtimeReset(), status: 'running' });
    log('Simulation started', 'info');
    void loop(generation);
  };

  return {
    active: false,
    status: 'idle',
    mode: prefs.get<SimMode>('simulationMode', 'auto'),
    speed: prefs.get('simulationSpeed', 1),
    follow: prefs.get('followToken', true),
    issues: null,
    ...runtimeReset(),

    start: () => {
      const { nodes, edges } = useFlowStore.getState();
      const issues = validateFlow({ nodes, edges });
      const errors = issues.filter((i) => i.level === 'error');
      if (errors.length) {
        set({ issues });
        return false;
      }
      useFlowStore.getState().clearSelection();
      set({ active: true, issues: null });
      begin(get().mode === 'step');
      issues.forEach((i) => log(i.message, 'warn', i.nodeId));
      return true;
    },
    exit: () => {
      generation++;
      tokens = [];
      set({ ...runtimeReset(), active: false, status: 'idle' });
    },
    play: () => {
      const { status, mode } = get();
      if (status === 'idle' || status === 'completed' || status === 'stopped') return begin(mode === 'step');
      if (status === 'paused') {
        pauseAtGate = mode === 'step';
        set({ status: 'running' });
        releaseGate?.();
      }
    },
    pause: () => {
      if (get().status === 'running') set({ status: 'paused' });
    },
    next: () => {
      const { status } = get();
      if (status === 'idle' || status === 'completed' || status === 'stopped') return begin(true);
      if (status === 'paused' || status === 'running') {
        pauseAtGate = true;
        set({ status: 'running' });
        releaseGate?.();
      }
    },
    restart: () => begin(get().mode === 'step'),
    choose: (branch) => resolveDecision?.(branch),
    setSpeed: (speed) => {
      prefs.set('simulationSpeed', speed);
      set({ speed });
    },
    setMode: (mode) => {
      prefs.set('simulationMode', mode);
      // Switching to auto while parked at a step gate keeps waiting for Play.
      pauseAtGate = mode === 'step';
      set({ mode });
    },
    toggleFollow: () => {
      const follow = !get().follow;
      prefs.set('followToken', follow);
      set({ follow });
    },
    dismissIssues: () => set({ issues: null }),
  };
});

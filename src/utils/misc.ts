import type { FlowEdge, FlowNode, Payload } from '../types/flow';

export function uid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function parsePayload(source: string | undefined): { ok: true; value: Payload } | { ok: false; error: string } {
  if (!source || !source.trim()) return { ok: true, value: {} };
  try {
    const value: unknown = JSON.parse(source);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'Payload must be a JSON object' };
    }
    return { ok: true, value: value as Payload };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

/** Strip transient React Flow fields so only the document is persisted. */
export function cleanNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map(({ id, type, position, data }) => ({
    id,
    type,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    data,
  }));
}

export function cleanEdges(edges: FlowEdge[]): FlowEdge[] {
  return edges.map(({ id, source, target, sourceHandle, targetHandle, data }) => ({
    id,
    type: 'flow' as const,
    source,
    target,
    sourceHandle: sourceHandle ?? null,
    targetHandle: targetHandle ?? null,
    data,
  }));
}

export function formatClock(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

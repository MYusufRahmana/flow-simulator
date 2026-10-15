import { FLOWCHART_SIZE } from '../../components/nodes/registry';
import type { FlowNode } from '../../types/flow';

/** Handle id used by the whole-node drop zone while a connection is being dragged. */
export const AUTO_HANDLE = 'auto';

const SIDE_HANDLES = new Set(['false', 'fail', 'out-right']);

function box(n: Pick<FlowNode, 'position' | 'measured' | 'type'>) {
  const fc = n.type ? FLOWCHART_SIZE[n.type] : undefined;
  const w = n.measured?.width ?? fc?.w ?? (n.type === 'start' || n.type === 'end' ? 160 : 232);
  const h = n.measured?.height ?? fc?.h ?? 60;
  return { x: n.position.x, y: n.position.y, w, h, cx: n.position.x + w / 2, cy: n.position.y + h / 2 };
}

/**
 * When a connection is dropped anywhere on a node, pick the target side that gives the cleanest line:
 * from the top when the target sits below, from the left when it sits to the right
 * (always for the right-hand FALSE / FAILED handles), from the right for an End node on the left.
 */
export function pickTargetHandle(
  source: Pick<FlowNode, 'position' | 'measured' | 'type'>,
  sourceHandle: string | null | undefined,
  target: Pick<FlowNode, 'position' | 'measured' | 'type'>,
): 'top' | 'left' | 'right' {
  const s = box(source);
  const t = box(target);
  const toTheRight = t.x >= s.x + s.w - 8;
  const toTheLeft = t.x + t.w <= s.x + 8;
  const below = t.y >= s.y + s.h;

  if (SIDE_HANDLES.has(sourceHandle ?? '') && toTheRight) return 'left';
  if (below && !toTheRight && !toTheLeft) return 'top';
  if (toTheRight) return 'left';
  if (toTheLeft && target.type === 'end') return 'right';
  return 'top';
}

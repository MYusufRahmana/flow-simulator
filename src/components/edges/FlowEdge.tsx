import { EdgeLabelRenderer, getSmoothStepPath, Position, useStore, type EdgeProps } from '@xyflow/react';
import { memo, useRef } from 'react';
import { isFlowchartKind } from '../nodes/registry';
import { useSimulationStore } from '../../stores/simulationStore';
import type { Branch, FlowEdge as FlowEdgeType } from '../../types/flow';
import { prefersReducedMotion } from '../../utils/misc';
import { edgeBranch } from '../../features/simulation/engine';

const STROKE = {
  IDLE: '#a3a8b3',
  SELECTED: '#2f5bff',
  ACTIVE: '#2f5bff',
  SUCCESS: '#4c6ef5',
  FAILED: '#e03131',
  SKIPPED: '#cfd2d8',
  FLOW: '#7b93f7',
} as const;

const BRANCH_PILL: Record<Branch, string> = {
  TRUE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FALSE: 'bg-red-50 text-red-700 border-red-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

/** SVG markers shared by every edge; rendered once inside the canvas. */
export function EdgeMarkers() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {Object.entries(STROKE).map(([key, color]) => (
          <marker
            key={key}
            id={`arrow-${key}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

const STRAIGHTEN_PX = 10;
const isHorizontal = (p: Position) => p === Position.Left || p === Position.Right;

function payloadPreview(payload: Record<string, unknown> | undefined) {
  if (!payload) return null;
  const keys = Object.keys(payload);
  if (!keys.length) return null;
  const shown = keys.slice(0, 2).join(', ');
  return `{ ${shown}${keys.length > 2 ? `, +${keys.length - 2}` : ''} }`;
}

function FlowEdge(props: EdgeProps<FlowEdgeType>) {
  const { id, source, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const pathRef = useRef<SVGPathElement>(null);
  // Flowchart connections are for presenting: they animate continuously, no simulation needed.
  const diagram = useStore((s) => isFlowchartKind(s.nodeLookup.get(source)?.type));
  const status = useSimulationStore((s) => s.edgeStatus[id] ?? 'IDLE');
  const progress = useSimulationStore((s) => (s.edgeStatus[id] === 'ACTIVE' ? s.progress : -1));
  const payload = useSimulationStore((s) => s.edgePayload[id]);

  // Ends that are almost level (or almost in one column) get a straight line instead of a tiny jog.
  const horizontal = isHorizontal(sourcePosition) && isHorizontal(targetPosition);
  const vertical = !isHorizontal(sourcePosition) && !isHorizontal(targetPosition);
  const tx = vertical && Math.abs(targetX - sourceX) <= STRAIGHTEN_PX ? sourceX : targetX;
  const ty = horizontal && Math.abs(targetY - sourceY) <= STRAIGHTEN_PX ? sourceY : targetY;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX: tx,
    targetY: ty,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
    offset: 24,
  });

  const branch = edgeBranch({ data, sourceHandle: props.sourceHandleId });
  const label = data?.label ?? branch?.toLowerCase();
  const animated = data?.animation !== false;
  const flowing = diagram && animated;
  const key = status !== 'IDLE' ? status : selected ? 'SELECTED' : diagram ? 'FLOW' : 'IDLE';
  const active = status === 'ACTIVE';
  // Keep the dot at a steady speed (~120px/s) whatever the edge length.
  const loopSeconds = Math.max(1.2, (Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY)) / 120);

  let token: { x: number; y: number } | null = null;
  if (active && animated && pathRef.current) {
    const len = pathRef.current.getTotalLength();
    const p = prefersReducedMotion() ? 0.5 : progress;
    const pt = pathRef.current.getPointAtLength(len * Math.max(0, Math.min(1, p)));
    token = { x: pt.x, y: pt.y };
  }
  const preview = active ? payloadPreview(payload) : null;

  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={20} className="react-flow__edge-interaction" />
      <path
        ref={pathRef}
        d={path}
        fill="none"
        className={`flow-edge-path ${active && animated ? 'edge-active' : flowing ? 'edge-flowing' : ''}`}
        stroke={STROKE[key]}
        strokeWidth={active || selected || diagram ? 2 : 1.5}
        strokeDasharray={status === 'SKIPPED' ? '4 4' : undefined}
        markerEnd={`url(#arrow-${key})`}
        style={{ transition: 'stroke 0.2s' }}
      />
      {flowing && !prefersReducedMotion() && (
        <g pointerEvents="none" className="flow-dot">
          <circle r={9} fill="#2f5bff" opacity={0.14}>
            <animateMotion dur={`${loopSeconds}s`} repeatCount="indefinite" path={path} />
          </circle>
          <circle r={4.5} fill="#2f5bff" stroke="#fff" strokeWidth={1.5}>
            <animateMotion dur={`${loopSeconds}s`} repeatCount="indefinite" path={path} />
          </circle>
        </g>
      )}
      {token && (
        <g pointerEvents="none">
          <circle cx={token.x} cy={token.y} r={11} fill="#2f5bff" opacity={0.14} />
          <circle cx={token.x} cy={token.y} r={5.5} fill="#2f5bff" stroke="#fff" strokeWidth={2} />
        </g>
      )}
      <EdgeLabelRenderer>
        {label && (
          <div
            data-edge-id={id}
            className={`nodrag nopan pointer-events-none absolute rounded-full border px-2 py-0.5 text-[10.5px] font-semibold leading-none ${
              branch ? BRANCH_PILL[branch] : 'border-black/10 bg-white text-gray-600'
            } ${status === 'SKIPPED' ? 'opacity-50' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        )}
        {token && preview && (
          <div
            className="pointer-events-none absolute rounded-md bg-gray-900 px-1.5 py-1 font-mono text-[10px] leading-none whitespace-nowrap text-white shadow"
            style={{ transform: `translate(14px, -50%) translate(${token.x}px, ${token.y}px)` }}
          >
            {preview}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(FlowEdge);

import { EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo, useRef } from 'react';
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

function payloadPreview(payload: Record<string, unknown> | undefined) {
  if (!payload) return null;
  const keys = Object.keys(payload);
  if (!keys.length) return null;
  const shown = keys.slice(0, 2).join(', ');
  return `{ ${shown}${keys.length > 2 ? `, +${keys.length - 2}` : ''} }`;
}

function FlowEdge(props: EdgeProps<FlowEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const pathRef = useRef<SVGPathElement>(null);
  const status = useSimulationStore((s) => s.edgeStatus[id] ?? 'IDLE');
  const progress = useSimulationStore((s) => (s.edgeStatus[id] === 'ACTIVE' ? s.progress : -1));
  const payload = useSimulationStore((s) => s.edgePayload[id]);

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
    offset: 24,
  });

  const branch = edgeBranch({ data, sourceHandle: props.sourceHandleId });
  const label = data?.label ?? branch?.toLowerCase();
  const animated = data?.animation !== false;
  const key = status !== 'IDLE' ? status : selected ? 'SELECTED' : 'IDLE';
  const active = status === 'ACTIVE';

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
        className={`flow-edge-path ${active && animated ? 'edge-active' : ''}`}
        stroke={STROKE[key]}
        strokeWidth={active || selected ? 2 : 1.5}
        strokeDasharray={status === 'SKIPPED' ? '4 4' : undefined}
        markerEnd={`url(#arrow-${key})`}
        style={{ transition: 'stroke 0.2s' }}
      />
      {token && (
        <g pointerEvents="none">
          <circle cx={token.x} cy={token.y} r={11} fill="#2f5bff" opacity={0.14} />
          <circle cx={token.x} cy={token.y} r={5.5} fill="#2f5bff" stroke="#fff" strokeWidth={2} />
        </g>
      )}
      <EdgeLabelRenderer>
        {label && (
          <div
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

import { Handle, NodeToolbar, Position, useConnection, type NodeProps } from '@xyflow/react';
import { Check, Loader2, X } from 'lucide-react';
import { memo } from 'react';
import { AUTO_HANDLE } from '../../features/editor/connect';
import { useSimulationStore } from '../../stores/simulationStore';
import type { FlowNode, HttpMethod, NodeKind } from '../../types/flow';
import { NODE_META, nodeSubtitle } from './registry';

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: 'text-emerald-700 bg-emerald-50',
  POST: 'text-blue-700 bg-blue-50',
  PUT: 'text-amber-700 bg-amber-50',
  PATCH: 'text-violet-700 bg-violet-50',
  DELETE: 'text-red-700 bg-red-50',
};

const TERMINAL: NodeKind[] = ['start', 'end'];

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'IDLE' || status === 'SKIPPED') return null;
  const base = 'absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-white';
  if (status === 'PROCESSING')
    return (
      <span className={`${base} bg-[var(--color-brand)]`} aria-label="Processing">
        <Loader2 size={11} className="spin" strokeWidth={3} />
      </span>
    );
  if (status === 'SUCCESS')
    return (
      <span className={`${base} bg-emerald-500`} aria-label="Success">
        <Check size={11} strokeWidth={3.5} />
      </span>
    );
  return (
    <span className={`${base} bg-red-500`} aria-label="Failed">
      <X size={11} strokeWidth={3.5} />
    </span>
  );
}

function FlowNodeCard({ id, type, data, selected }: NodeProps<FlowNode>) {
  const meta = NODE_META[type];
  const Icon = meta.icon;
  const status = useSimulationStore((s) => s.nodeStatus[id]);
  const simActive = useSimulationStore((s) => s.active);
  const finished = useSimulationStore((s) => s.status === 'completed' || s.status === 'stopped');
  const pending = useSimulationStore((s) => s.pendingDecision === id);
  const choose = useSimulationStore((s) => s.choose);
  const config = data.config ?? {};
  const subtitle = type === 'api' ? config.endpoint : nodeSubtitle({ type, data });
  const terminal = TERMINAL.includes(type);
  // While a connection is being dragged from another node, this whole node becomes a drop target.
  const dropTarget = useConnection((c) => c.inProgress && c.fromNode.id !== id && c.fromHandle.type === 'source' && type !== 'start');

  const stateClass =
    status === 'PROCESSING'
      ? 'border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/20 node-processing'
      : status === 'SUCCESS'
        ? 'border-emerald-400'
        : status === 'FAILED'
          ? 'border-red-400 bg-red-50/40'
          : selected
            ? 'border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/15'
            : 'border-black/10 hover:border-black/20';
  // Once a run is over, untouched nodes fade so the travelled path stands out.
  const dim = simActive && (status === 'SKIPPED' || (finished && !status));

  return (
    <div
      className={`relative bg-white transition-[border-color,box-shadow,opacity] duration-150 ${stateClass} ${
        dim ? 'opacity-40' : ''
      } ${
        terminal
          ? 'flex w-[160px] items-center justify-center gap-2 rounded-full border px-4 py-2.5'
          : 'flex w-[232px] items-center gap-2.5 rounded-[10px] border px-3 py-2.5'
      } shadow-[0_1px_2px_rgb(16_24_40/0.05)]`}
      title={data.description}
    >
      {dropTarget && (
        <Handle
          id={AUTO_HANDLE}
          type="target"
          position={Position.Top}
          className={`handle-dropzone ${terminal ? 'handle-dropzone-pill' : ''}`}
        />
      )}
      {type !== 'start' && (
        <>
          <Handle id="top" type="target" position={Position.Top} />
          <Handle id="left" type="target" position={Position.Left} />
          {type === 'end' && <Handle id="right" type="target" position={Position.Right} />}
        </>
      )}

      {terminal ? (
        <>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-white"
            style={{ background: meta.color }}
          >
            <Icon size={12} strokeWidth={2.5} fill={type === 'start' ? 'currentColor' : 'none'} />
          </span>
          <span className="truncate text-[13px] font-semibold">{data.label || meta.label}</span>
        </>
      ) : (
        <>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${meta.color}14`, color: meta.color }}
          >
            <Icon size={17} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
              {meta.label}
              {type === 'decision' && config.outcome === 'ASK' && (
                <span className="rounded bg-amber-50 px-1 text-[9px] font-semibold text-amber-700">ASK</span>
              )}
              {config.fail && <span className="rounded bg-red-50 px-1 text-[9px] font-semibold text-red-600">FAIL</span>}
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-semibold text-gray-900">{data.label || 'Untitled'}</span>
            {(subtitle || (type === 'api' && config.method)) && (
              <span className="mt-1 flex min-w-0 items-center gap-1 font-mono text-[10.5px] text-gray-500">
                {type === 'api' && config.method && (
                  <span className={`rounded px-1 py-px text-[9.5px] font-semibold ${METHOD_COLOR[config.method]}`}>
                    {config.method}
                  </span>
                )}
                {type === 'api' && config.statusCode ? (
                  <span className={config.statusCode >= 400 ? 'text-red-600' : 'text-gray-400'}>{config.statusCode}</span>
                ) : null}
                <span className="truncate">{subtitle}</span>
              </span>
            )}
          </span>
        </>
      )}

      <StatusBadge status={status} />

      {type === 'decision' ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} className="handle-true" title="TRUE" />
          <Handle id="false" type="source" position={Position.Right} className="handle-false" title="FALSE" />
        </>
      ) : type !== 'end' ? (
        <>
          <Handle id="out" type="source" position={Position.Bottom} />
          {meta.canFail && <Handle id="fail" type="source" position={Position.Right} className="handle-fail" title="FAILED path" />}
        </>
      ) : null}

      <NodeToolbar isVisible={pending} position={Position.Bottom} offset={14}>
        <div className="panel fade-in flex items-center gap-1 p-1">
          <span className="px-2 text-xs font-medium text-gray-500">Choose path</span>
          <button
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            onClick={() => choose('TRUE')}
          >
            TRUE
          </button>
          <button
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            onClick={() => choose('FALSE')}
          >
            FALSE
          </button>
        </div>
      </NodeToolbar>
    </div>
  );
}

export default memo(FlowNodeCard);

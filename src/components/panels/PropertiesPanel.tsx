import { ArrowRight, Copy, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFlowStore } from '../../stores/flowStore';
import { useSimulationStore } from '../../stores/simulationStore';
import type { Branch, DbAction, FlowEdge, FlowNode, HttpMethod, NodeKind } from '../../types/flow';
import { parsePayload } from '../../utils/misc';
import { Field, IconButton, inputClass, Segmented, Toggle } from '../common/ui';
import { NODE_KINDS, NODE_META } from '../nodes/registry';
import { copyWithToast } from '../../features/editor/clipboard';
import { edgeBranch } from '../../features/simulation/engine';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const DB_ACTIONS: DbAction[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRANSACTION'];
const BRANCHES: (Branch | '')[] = ['', 'TRUE', 'FALSE', 'SUCCESS', 'FAILED'];

function JsonField({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const parsed = parsePayload(value);
  return (
    <Field
      label={label}
      hint={
        value?.trim() ? (
          parsed.ok ? (
            <span className="text-emerald-600">valid JSON</span>
          ) : (
            <span className="max-w-[160px] truncate text-red-600" title={parsed.error}>
              {parsed.error}
            </span>
          )
        ) : null
      }
    >
      <textarea
        className={`${inputClass} min-h-[84px] resize-y font-mono text-[12px] leading-relaxed ${!parsed.ok ? '!border-red-300' : ''}`}
        value={value ?? ''}
        spellCheck={false}
        placeholder={placeholder ?? '{\n  "key": "value"\n}'}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function PanelShell({ title, icon, onClose, children, actions }: {
  title: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <aside
      aria-label="Properties"
      className="panel fade-in pointer-events-auto absolute top-[84px] right-3 z-10 flex max-h-[calc(100%-180px)] w-[300px] flex-col"
    >
      <header className="flex items-center gap-2 border-b border-black/6 px-3 py-2.5">
        {icon}
        <div className="min-w-0 flex-1 text-[13px] font-semibold">{title}</div>
        {actions}
        {onClose && (
          <IconButton label="Close" onClick={onClose} className="!h-7 !w-7">
            <X size={15} />
          </IconButton>
        )}
      </header>
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}

function NodeProperties({ node }: { node: FlowNode }) {
  const updateData = useFlowStore((s) => s.updateNodeData);
  const updateConfig = useFlowStore((s) => s.updateNodeConfig);
  const changeType = useFlowStore((s) => s.changeNodeType);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const c = node.data.config ?? {};
  const set = (patch: Partial<FlowNode['data']>) => updateData(node.id, patch);
  const cfg = (patch: NonNullable<FlowNode['data']['config']>) => updateConfig(node.id, patch);

  const pathTarget = (branch: Branch) => {
    const e = edges.find((e) => e.source === node.id && edgeBranch(e) === branch);
    return e ? nodes.find((n) => n.id === e.target)?.data.label ?? '—' : null;
  };

  return (
    <PanelShell
      title={
        <>
          <span className="block text-[10.5px] font-medium tracking-wider text-gray-400 uppercase">Node properties</span>
          <span className="block truncate">{node.data.label || meta.label}</span>
        </>
      }
      icon={
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${meta.color}14`, color: meta.color }}>
          <Icon size={16} />
        </span>
      }
      onClose={() => useFlowStore.getState().clearSelection()}
      actions={
        <>
          <IconButton label="Duplicate" shortcut="Ctrl+D" className="!h-7 !w-7" onClick={() => useFlowStore.getState().duplicateSelection()}>
            <Copy size={14} />
          </IconButton>
          <IconButton label="Delete" shortcut="Del" className="!h-7 !w-7 hover:!text-red-600" onClick={() => useFlowStore.getState().deleteNode(node.id)}>
            <Trash2 size={14} />
          </IconButton>
        </>
      }
    >
      <Field label="Name">
        <input className={inputClass} value={node.data.label} onChange={(e) => set({ label: e.target.value })} autoFocus={!node.data.label} />
      </Field>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Field label="Type">
          <select className={inputClass} value={node.type} onChange={(e) => changeType(node.id, e.target.value as NodeKind)}>
            {NODE_KINDS.map((k) => (
              <option key={k} value={k}>
                {NODE_META[k].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration">
          <div className="relative">
            <input
              type="number"
              min={0}
              step={100}
              className={`${inputClass} pr-8`}
              value={node.data.duration ?? 500}
              onChange={(e) => set({ duration: Math.max(0, Number(e.target.value) || 0) })}
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] text-gray-400">ms</span>
          </div>
        </Field>
      </div>
      <Field label="Description">
        <textarea
          className={`${inputClass} min-h-[56px] resize-y`}
          value={node.data.description ?? ''}
          placeholder="What happens at this step?"
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>

      {node.type !== 'start' && node.type !== 'end' && <div className="h-px bg-black/6" />}

      {node.type === 'input' && (
        <Field label="Fields">
          <input className={inputClass} value={c.fields ?? ''} placeholder="name, email" onChange={(e) => cfg({ fields: e.target.value })} />
        </Field>
      )}
      {node.type === 'page' && (
        <Field label="Route">
          <input className={`${inputClass} font-mono`} value={c.route ?? ''} placeholder="/dashboard" onChange={(e) => cfg({ route: e.target.value })} />
        </Field>
      )}
      {node.type === 'decision' && (
        <>
          <Field label="Condition">
            <input className={`${inputClass} font-mono`} value={c.condition ?? ''} placeholder="payload.valid" onChange={(e) => cfg({ condition: e.target.value })} />
          </Field>
          <div>
            <div className="mb-1 text-[11px] font-medium text-gray-500">Simulated outcome</div>
            <Segmented
              label="Simulated outcome"
              value={c.outcome ?? 'TRUE'}
              onChange={(outcome) => cfg({ outcome })}
              options={[
                { value: 'TRUE', label: 'TRUE' },
                { value: 'FALSE', label: 'FALSE' },
                { value: 'ASK', label: 'Ask me', title: 'Pause and let you choose during the simulation' },
              ]}
            />
          </div>
          <div className="space-y-1 rounded-lg bg-gray-50 p-2.5 text-[12px]">
            {(['TRUE', 'FALSE'] as const).map((b) => {
              const t = pathTarget(b);
              return (
                <div key={b} className="flex items-center gap-1.5">
                  <span className={`w-12 font-semibold ${b === 'TRUE' ? 'text-emerald-600' : 'text-red-600'}`}>{b}</span>
                  <ArrowRight size={12} className="text-gray-400" />
                  <span className={t ? 'truncate text-gray-700' : 'text-gray-400 italic'}>{t ?? 'not connected'}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {node.type === 'api' && (
        <>
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <Field label="Method">
              <select className={inputClass} value={c.method ?? 'GET'} onChange={(e) => cfg({ method: e.target.value as HttpMethod })}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Endpoint">
              <input className={`${inputClass} font-mono`} value={c.endpoint ?? ''} placeholder="/api/users" onChange={(e) => cfg({ endpoint: e.target.value })} />
            </Field>
          </div>
          <Field label="Status code" hint={<span className="text-gray-400">≥ 400 follows the FAILED path</span>}>
            <input
              type="number"
              className={inputClass}
              value={c.statusCode ?? 200}
              onChange={(e) => cfg({ statusCode: Number(e.target.value) || 200 })}
            />
          </Field>
          <JsonField label="Response" value={c.response} onChange={(response) => cfg({ response })} />
        </>
      )}
      {node.type === 'backend' && (
        <Field label="Handler">
          <input className={`${inputClass} font-mono`} value={c.handler ?? ''} placeholder="store()" onChange={(e) => cfg({ handler: e.target.value })} />
        </Field>
      )}
      {node.type === 'database' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Database">
              <input className={`${inputClass} font-mono`} value={c.database ?? ''} onChange={(e) => cfg({ database: e.target.value })} />
            </Field>
            <Field label="Table">
              <input className={`${inputClass} font-mono`} value={c.table ?? ''} onChange={(e) => cfg({ table: e.target.value })} />
            </Field>
          </div>
          <Field label="Action">
            <select className={inputClass} value={c.action ?? 'SELECT'} onChange={(e) => cfg({ action: e.target.value as DbAction })}>
              {DB_ACTIONS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      {node.type === 'external' && (
        <Field label="Service">
          <input className={inputClass} value={c.service ?? ''} onChange={(e) => cfg({ service: e.target.value })} />
        </Field>
      )}
      {node.type === 'notification' && (
        <Field label="Channel">
          <input className={inputClass} value={c.channel ?? ''} placeholder="Email, Push, WhatsApp" onChange={(e) => cfg({ channel: e.target.value })} />
        </Field>
      )}
      {node.type === 'error' && (
        <Field label="Error code">
          <input className={`${inputClass} font-mono`} value={c.code ?? ''} placeholder="422" onChange={(e) => cfg({ code: e.target.value })} />
        </Field>
      )}

      {node.type !== 'end' && (
        <JsonField
          label={node.type === 'start' ? 'Initial payload' : 'Payload (merged into data)'}
          value={node.data.payload}
          onChange={(payload) => set({ payload })}
        />
      )}

      {meta.canFail && (
        <div className="rounded-lg border border-black/6 p-2.5">
          <Toggle label="Simulate failure" checked={!!c.fail} onChange={(fail) => cfg({ fail })} />
          <p className="mt-1 text-[11px] leading-snug text-gray-400">Follows the red FAILED handle on the right side of the node.</p>
        </div>
      )}
    </PanelShell>
  );
}

function EdgeProperties({ edge }: { edge: FlowEdge }) {
  const update = useFlowStore((s) => s.updateEdgeData);
  const nodes = useFlowStore((s) => s.nodes);
  const from = nodes.find((n) => n.id === edge.source)?.data.label;
  const to = nodes.find((n) => n.id === edge.target)?.data.label;
  const set = (patch: Partial<NonNullable<FlowEdge['data']>>) => update(edge.id, patch);

  return (
    <PanelShell
      title={
        <>
          <span className="block text-[10.5px] font-medium tracking-wider text-gray-400 uppercase">Connection</span>
          <span className="flex min-w-0 items-center gap-1 truncate">
            <span className="truncate">{from}</span>
            <ArrowRight size={13} className="shrink-0 text-gray-400" />
            <span className="truncate">{to}</span>
          </span>
        </>
      }
      onClose={() => useFlowStore.getState().clearSelection()}
      actions={
        <IconButton label="Delete connection" className="!h-7 !w-7 hover:!text-red-600" onClick={() => useFlowStore.getState().deleteEdge(edge.id)}>
          <Trash2 size={14} />
        </IconButton>
      }
    >
      <Field label="Label">
        <input className={inputClass} value={edge.data?.label ?? ''} placeholder="submit, valid, 201…" onChange={(e) => set({ label: e.target.value })} />
      </Field>
      <Field label="Branch">
        <select
          className={inputClass}
          value={edge.data?.branch ?? ''}
          onChange={(e) => set({ branch: (e.target.value || undefined) as Branch | undefined })}
        >
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b || 'Default (from handle)'}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea
          className={`${inputClass} min-h-[56px] resize-y`}
          value={edge.data?.description ?? ''}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      <Toggle label="Animate token" checked={edge.data?.animation !== false} onChange={(animation) => set({ animation })} />
    </PanelShell>
  );
}

function Inspector() {
  const selectedId = useFlowStore((s) => s.selectedNodeIds[0]);
  const node = useFlowStore((s) => s.nodes.find((n) => n.id === selectedId));
  const currentIds = useSimulationStore((s) => s.currentNodeIds);
  const currentPayload = useSimulationStore((s) => s.currentPayload);
  const payloadAt = useSimulationStore((s) => (selectedId ? s.payloadByNode[selectedId] : undefined));
  const status = useSimulationStore((s) => (selectedId ? s.nodeStatus[selectedId] : undefined));
  const currentNode = useFlowStore((s) => s.nodes.find((n) => n.id === currentIds[0]));
  const finished = useSimulationStore((s) => s.status === 'completed' || s.status === 'stopped');

  const shown = node ?? currentNode;
  const payload = node ? payloadAt : currentPayload;
  const meta = shown ? NODE_META[shown.type] : null;
  const Icon = meta?.icon;

  return (
    <PanelShell
      title={
        <>
          <span className="block text-[10.5px] font-medium tracking-wider text-gray-400 uppercase">
            {node ? 'Inspect node' : finished ? 'Result' : 'Current step'}
          </span>
          <span className="block truncate">{shown?.data.label ?? (finished ? 'Flow finished' : 'Waiting…')}</span>
        </>
      }
      icon={
        meta && Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${meta.color}14`, color: meta.color }}>
            <Icon size={16} />
          </span>
        ) : undefined
      }
      onClose={node ? () => useFlowStore.getState().clearSelection() : undefined}
    >
      {node && (
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-500">Status</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              status === 'SUCCESS'
                ? 'bg-emerald-50 text-emerald-700'
                : status === 'FAILED'
                  ? 'bg-red-50 text-red-700'
                  : status === 'PROCESSING'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
            }`}
          >
            {status ?? 'NOT REACHED'}
          </span>
        </div>
      )}
      {shown?.data.description && <p className="text-[12.5px] leading-relaxed text-gray-600">{shown.data.description}</p>}
      <div>
        <div className="mb-1 text-[11px] font-medium text-gray-500">{node ? 'Payload after this node' : finished ? 'Final payload' : 'Current payload'}</div>
        <pre className="scroll-thin max-h-[320px] overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-[11.5px] leading-relaxed text-gray-100">
          {payload && Object.keys(payload).length ? JSON.stringify(payload, null, 2) : '{}'}
        </pre>
      </div>
      {!node && <p className="text-[11px] text-gray-400">Click any node to inspect the data it produced.</p>}
    </PanelShell>
  );
}

export default function PropertiesPanel() {
  const simActive = useSimulationStore((s) => s.active);
  const nodeIds = useFlowStore((s) => s.selectedNodeIds);
  const edgeIds = useFlowStore((s) => s.selectedEdgeIds);
  const node = useFlowStore((s) => (nodeIds.length === 1 ? s.nodes.find((n) => n.id === nodeIds[0]) : undefined));
  const edge = useFlowStore((s) => (edgeIds.length === 1 && !nodeIds.length ? s.edges.find((e) => e.id === edgeIds[0]) : undefined));

  if (simActive) return <Inspector />;
  if (nodeIds.length + edgeIds.length > 1) {
    return (
      <PanelShell title={`${nodeIds.length + edgeIds.length} items selected`}>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg border border-black/10 py-1.5 text-[13px] font-medium hover:bg-gray-50" onClick={copyWithToast}>
            Copy
          </button>
          <button className="flex-1 rounded-lg border border-black/10 py-1.5 text-[13px] font-medium hover:bg-gray-50" onClick={() => useFlowStore.getState().duplicateSelection()}>
            Duplicate
          </button>
          <button className="flex-1 rounded-lg border border-red-200 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50" onClick={() => useFlowStore.getState().deleteSelection()}>
            Delete
          </button>
        </div>
      </PanelShell>
    );
  }
  if (node) return <NodeProperties key={node.id} node={node} />;
  if (edge) return <EdgeProperties key={edge.id} edge={edge} />;
  return null;
}

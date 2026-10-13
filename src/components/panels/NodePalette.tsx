import { useReactFlow } from '@xyflow/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useFlowStore } from '../../stores/flowStore';
import { useUiStore } from '../../stores/uiStore';
import type { NodeKind } from '../../types/flow';
import { IconButton } from '../common/ui';
import { DND_TYPE } from '../flow/FlowCanvas';
import { NODE_GROUPS, NODE_META } from '../nodes/registry';

export default function NodePalette() {
  const collapsed = useUiStore((s) => s.paletteCollapsed);
  const toggle = useUiStore((s) => s.togglePalette);
  const { screenToFlowPosition } = useReactFlow();

  const addAtCenter = (kind: NodeKind) => {
    const p = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const jitter = (useFlowStore.getState().nodes.length % 5) * 24;
    useFlowStore.getState().addNode(kind, { x: Math.round((p.x - 116 + jitter) / 12) * 12, y: Math.round((p.y - 28 + jitter) / 12) * 12 });
  };

  return (
    <aside
      aria-label="Components"
      className={`panel scroll-thin pointer-events-auto absolute top-[84px] left-3 z-10 flex max-h-[calc(100%-180px)] flex-col overflow-y-auto ${
        collapsed ? 'w-[52px] items-center py-1.5' : 'w-[212px] p-2'
      }`}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-1.5 pb-1'}`}>
        {!collapsed && <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Components</span>}
        <IconButton label={collapsed ? 'Expand components' : 'Collapse components'} onClick={toggle} className="!h-8 !w-8">
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </IconButton>
      </div>

      {NODE_GROUPS.map((group, gi) => (
        <div key={group.name} className={collapsed ? 'flex flex-col items-center' : ''}>
          {collapsed ? (
            gi > 0 && <span className="my-1 h-px w-6 bg-black/8" />
          ) : (
            <div className="px-1.5 pt-2.5 pb-1 text-[10.5px] font-medium text-gray-400">{group.name}</div>
          )}
          {group.kinds.map((kind) => {
            const meta = NODE_META[kind];
            const Icon = meta.icon;
            return (
              <button
                key={kind}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_TYPE, kind);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addAtCenter(kind)}
                title={`${meta.label} — ${meta.hint}. Drag onto the canvas or click to add.`}
                aria-label={`Add ${meta.label}`}
                className={`group flex cursor-grab items-center rounded-lg text-left transition hover:bg-gray-100 active:cursor-grabbing ${
                  collapsed ? 'h-9 w-9 justify-center' : 'w-full gap-2.5 px-1.5 py-1.5'
                }`}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ background: `${meta.color}14`, color: meta.color }}
                >
                  <Icon size={15} />
                </span>
                {!collapsed && (
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[13px] font-medium text-gray-800">{meta.label}</span>
                    <span className="block truncate text-[11px] text-gray-400">{meta.hint}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

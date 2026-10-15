import { useReactFlow } from '@xyflow/react';
import { Cpu, PanelLeftClose, PanelLeftOpen, Shapes, type LucideIcon } from 'lucide-react';
import { useFlowStore } from '../../stores/flowStore';
import { useUiStore } from '../../stores/uiStore';
import type { NodeCategory, NodeKind } from '../../types/flow';
import { IconButton } from '../common/ui';
import { DND_TYPE } from '../flow/FlowCanvas';
import { halfWidthOf, isFlowchartKind, NODE_CATEGORIES, NODE_META } from '../nodes/registry';

const CATEGORY_ICON: Record<NodeCategory, LucideIcon> = { simulation: Cpu, flowchart: Shapes };

export default function NodePalette() {
  const collapsed = useUiStore((s) => s.paletteCollapsed);
  const toggle = useUiStore((s) => s.togglePalette);
  const categoryId = useUiStore((s) => s.paletteCategory);
  const setCategory = useUiStore((s) => s.setPaletteCategory);
  const category = NODE_CATEGORIES.find((c) => c.id === categoryId) ?? NODE_CATEGORIES[0];
  const { screenToFlowPosition } = useReactFlow();

  const addAtCenter = (kind: NodeKind) => {
    const p = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const jitter = (useFlowStore.getState().nodes.length % 5) * 24;
    const id = useFlowStore.getState().addNode(kind, {
      x: Math.round((p.x - halfWidthOf(kind) + jitter) / 12) * 12,
      y: Math.round((p.y - 28 + jitter) / 12) * 12,
    });
    // New flowchart shapes open straight into text editing.
    if (isFlowchartKind(kind)) useUiStore.getState().startEditing(id);
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

      {collapsed ? (
        <div className="mt-1 flex flex-col items-center gap-0.5 border-b border-black/8 pb-1.5">
          {NODE_CATEGORIES.map((c) => {
            const CatIcon = CATEGORY_ICON[c.id];
            return (
              <IconButton
                key={c.id}
                label={`${c.name} components`}
                pressed={c.id === categoryId}
                onClick={() => setCategory(c.id)}
                className="!h-8 !w-8"
              >
                <CatIcon size={15} />
              </IconButton>
            );
          })}
        </div>
      ) : (
        <div className="px-1 pt-1">
          <div role="tablist" aria-label="Component category" className="grid grid-cols-2 rounded-lg bg-gray-100 p-0.5">
            {NODE_CATEGORIES.map((c) => {
              const CatIcon = CATEGORY_ICON[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === categoryId}
                  onClick={() => setCategory(c.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition ${
                    c.id === categoryId ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <CatIcon size={13} />
                  {c.name}
                </button>
              );
            })}
          </div>
          <p className="px-0.5 pt-1.5 text-[11px] leading-snug text-gray-400">{category.hint}</p>
        </div>
      )}

      {category.groups.map((group, gi) => (
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

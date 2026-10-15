import { useReactFlow } from '@xyflow/react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowLeftRight,
  ChevronRight,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Download,
  Maximize,
  Pencil,
  Plus,
  Repeat,
  Scissors,
  SquareDashedMousePointer,
  Tag,
  Trash2,
  Zap,
  ZapOff,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { copyWithToast, cutWithToast, pasteWithToast } from '../../features/editor/clipboard';
import { useFlowStore } from '../../stores/flowStore';
import { useUiStore } from '../../stores/uiStore';
import type { NodeKind } from '../../types/flow';
import { halfWidthOf, isFlowchartKind, kindsInCategory, NODE_META } from '../nodes/registry';

export type ContextMenuState = {
  /** Screen position of the right-click. */
  x: number;
  y: number;
  /** Same point in flow coordinates (for "add / paste here"). */
  flowX: number;
  flowY: number;
} & ({ target: 'node'; id: string } | { target: 'edge'; id: string } | { target: 'selection' } | { target: 'pane' });

const WIDTH = 224;
const SWATCHES = ['#1c1d22', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0d9488', '#db2777'];

function Item({
  icon,
  label,
  shortcut,
  danger,
  disabled,
  onClick,
  children,
  flipSub,
}: {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Submenu content; shown on hover. */
  children?: ReactNode;
  flipSub?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        aria-haspopup={children ? 'menu' : undefined}
        onClick={children ? () => setOpen(true) : onClick}
        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
          danger ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-gray-800 hover:bg-gray-100 focus:bg-gray-100'
        }`}
      >
        <span className={`flex w-4 justify-center ${danger ? '' : 'text-gray-500'}`}>{icon}</span>
        <span className="flex-1">{label}</span>
        {shortcut && <span className="text-[11px] text-gray-400">{shortcut}</span>}
        {children && <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {children && open && (
        <div
          role="menu"
          className={`panel scroll-thin absolute top-[-6px] z-10 max-h-[340px] overflow-y-auto p-1.5 ${flipSub ? 'right-full mr-1' : 'left-full ml-1'}`}
          style={{ width: WIDTH }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="mx-2 my-1 h-px bg-black/6" />;
}

function ColorRow({ onPick }: { onPick: (color: string | undefined) => void }) {
  return (
    <div className="px-2 py-1.5">
      <div className="mb-1.5 text-[11px] font-medium text-gray-400">Warna</div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          title="Warna bawaan"
          aria-label="Warna bawaan"
          onClick={() => onPick(undefined)}
          className="h-5 w-5 rounded-full border border-dashed border-gray-400 bg-white"
        />
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Warna ${c}`}
            onClick={() => onPick(c)}
            className="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.12)] transition hover:scale-110"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

function KindList({ kinds, current, onPick }: { kinds: NodeKind[]; current?: NodeKind; onPick: (kind: NodeKind) => void }) {
  return (
    <>
      {kinds.map((kind) => {
        const meta = NODE_META[kind];
        const Icon = meta.icon;
        return (
          <button
            key={kind}
            type="button"
            role="menuitem"
            onClick={() => onPick(kind)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
              kind === current ? 'font-semibold text-[var(--color-brand)]' : 'text-gray-800'
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: `${meta.color}14`, color: meta.color }}>
              <Icon size={13} />
            </span>
            {meta.label}
          </button>
        );
      })}
    </>
  );
}

/** Right-click menu for nodes, edges, a multi-selection or the empty canvas. */
export default function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });
  const { fitView } = useReactFlow();
  const flow = useFlowStore.getState();
  const ui = useUiStore.getState();

  // Keep the menu on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - height - 8)),
    });
  }, [menu.x, menu.y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onClose, { passive: true });
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  /** Run an action and close the menu. */
  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const flipSub = pos.left + WIDTH * 2 + 16 > window.innerWidth;

  let body: ReactNode = null;

  if (menu.target === 'node') {
    const node = flow.nodes.find((n) => n.id === menu.id);
    if (!node) return null;
    const meta = NODE_META[node.type];
    const flowchart = meta.category === 'flowchart';
    body = (
      <>
        <div className="truncate px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
          {node.data.label?.split('\n')[0] || meta.label}
        </div>
        {flowchart ? (
          <Item icon={<Pencil size={14} />} label="Edit teks" shortcut="Enter" onClick={run(() => ui.startEditing(node.id))} />
        ) : (
          <Item icon={<Pencil size={14} />} label="Edit properti" onClick={run(() => flow.selectNode(node.id))} />
        )}
        <Item icon={<CopyPlus size={14} />} label="Duplikat" shortcut="Ctrl+D" onClick={run(() => flow.duplicateSelection())} />
        <Item icon={<Copy size={14} />} label="Copy" shortcut="Ctrl+C" onClick={run(copyWithToast)} />
        <Item icon={<Scissors size={14} />} label="Cut" shortcut="Ctrl+X" onClick={run(cutWithToast)} />
        <Separator />
        <Item icon={<Repeat size={14} />} label="Ganti tipe" flipSub={flipSub}>
          <KindList
            kinds={kindsInCategory(meta.category).filter((k) => k !== node.type)}
            onPick={(kind) => run(() => flow.changeNodeType(node.id, kind))()}
          />
        </Item>
        {flowchart && <ColorRow onPick={(color) => run(() => flow.updateNodeConfig(node.id, { color }))()} />}
        <Separator />
        <Item icon={<Trash2 size={14} />} label="Hapus" shortcut="Del" danger onClick={run(() => flow.deleteNode(node.id))} />
      </>
    );
  } else if (menu.target === 'selection') {
    const selected = flow.nodes.filter((n) => n.selected);
    const allFlowchart = selected.length > 0 && selected.every((n) => isFlowchartKind(n.type));
    body = (
      <>
        <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{selected.length} komponen dipilih</div>
        <Item icon={<CopyPlus size={14} />} label="Duplikat" shortcut="Ctrl+D" onClick={run(() => flow.duplicateSelection())} />
        <Item icon={<Copy size={14} />} label="Copy" shortcut="Ctrl+C" onClick={run(copyWithToast)} />
        <Item icon={<Scissors size={14} />} label="Cut" shortcut="Ctrl+X" onClick={run(cutWithToast)} />
        <Separator />
        <Item icon={<AlignCenterHorizontal size={14} />} label="Sejajarkan baris" disabled={selected.length < 2} onClick={run(() => flow.alignSelection('row'))} />
        <Item icon={<AlignCenterVertical size={14} />} label="Sejajarkan kolom" disabled={selected.length < 2} onClick={run(() => flow.alignSelection('column'))} />
        {allFlowchart && (
          <ColorRow
            onPick={(color) =>
              run(() =>
                flow.updateNodesConfig(
                  selected.map((n) => n.id),
                  { color },
                ),
              )()
            }
          />
        )}
        <Separator />
        <Item icon={<Trash2 size={14} />} label="Hapus" shortcut="Del" danger onClick={run(() => flow.deleteSelection())} />
      </>
    );
  } else if (menu.target === 'edge') {
    const edge = flow.edges.find((e) => e.id === menu.id);
    if (!edge) return null;
    const animated = edge.data?.animation !== false;
    body = (
      <>
        <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Garis penghubung</div>
        <Item icon={<Tag size={14} />} label="Edit label" onClick={run(() => flow.selectEdge(edge.id))} />
        <Item
          icon={animated ? <ZapOff size={14} /> : <Zap size={14} />}
          label={animated ? 'Matikan animasi' : 'Nyalakan animasi'}
          onClick={run(() => flow.updateEdgeData(edge.id, { animation: !animated }))}
        />
        <Item icon={<ArrowLeftRight size={14} />} label="Balik arah panah" onClick={run(() => flow.reverseEdge(edge.id))} />
        <Separator />
        <Item icon={<Trash2 size={14} />} label="Hapus garis" shortcut="Del" danger onClick={run(() => flow.deleteEdge(edge.id))} />
      </>
    );
  } else {
    const category = ui.paletteCategory;
    const at = { x: menu.flowX, y: menu.flowY };
    const addHere = (kind: NodeKind) => {
      const id = flow.addNode(kind, {
        x: Math.round((at.x - halfWidthOf(kind)) / 12) * 12,
        y: Math.round((at.y - 24) / 12) * 12,
      });
      if (isFlowchartKind(kind)) ui.startEditing(id);
    };
    body = (
      <>
        <Item icon={<Plus size={14} />} label="Tambah komponen di sini" flipSub={flipSub}>
          <KindList kinds={kindsInCategory(category)} onPick={(kind) => run(() => addHere(kind))()} />
        </Item>
        <Item icon={<ClipboardPaste size={14} />} label="Paste di sini" shortcut="Ctrl+V" onClick={run(() => pasteWithToast(at))} />
        <Separator />
        <Item icon={<Download size={14} />} label="Export…" shortcut="Ctrl+E" onClick={run(() => ui.setExportOpen(true))} />
        <Separator />
        <Item icon={<SquareDashedMousePointer size={14} />} label="Pilih semua" shortcut="Ctrl+A" onClick={run(() => flow.selectAll())} />
        <Item
          icon={<Maximize size={14} />}
          label="Tampilkan semua (fit view)"
          shortcut="Shift+1"
          onClick={run(() => void fitView({ padding: 0.2, duration: 300, maxZoom: 1 }))}
        />
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40"
      onMouseDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        role="menu"
        aria-label="Context menu"
        className="panel fade-in absolute p-1.5"
        style={{ left: pos.left, top: pos.top, width: WIDTH }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {body}
      </div>
    </div>
  );
}

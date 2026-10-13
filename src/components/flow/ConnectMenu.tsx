import { useEffect } from 'react';
import type { NodeKind } from '../../types/flow';
import { NODE_GROUPS, NODE_META } from '../nodes/registry';

export type ConnectMenuState = {
  /** Screen position where the connection was dropped. */
  x: number;
  y: number;
  /** Flow position for the new node. */
  flowX: number;
  flowY: number;
  source: string;
  sourceHandle: string | null;
};

const KINDS = NODE_GROUPS.flatMap((g) => g.kinds).filter((k) => k !== 'start');
const WIDTH = 248;
const MAX_HEIGHT = 360;

/** Pick-a-node menu shown when a connection is dropped on empty canvas. */
export default function ConnectMenu({
  menu,
  onPick,
  onClose,
}: {
  menu: ConnectMenuState;
  onPick: (kind: NodeKind) => void;
  onClose: () => void;
}) {
  // Capture phase so Escape closes the menu before the editor's own shortcuts see it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const left = Math.min(menu.x + 8, window.innerWidth - WIDTH - 12);
  const top = Math.max(12, Math.min(menu.y + 8, window.innerHeight - MAX_HEIGHT - 12));

  return (
    <div className="fixed inset-0 z-40" onMouseDown={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())}>
      <div
        role="menu"
        aria-label="Add a connected node"
        className="panel fade-in scroll-thin absolute overflow-y-auto p-1.5"
        style={{ left, top, width: WIDTH, maxHeight: MAX_HEIGHT }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Tambah node &amp; sambungkan</div>
        {KINDS.map((kind, i) => {
          const meta = NODE_META[kind];
          const Icon = meta.icon;
          return (
            <button
              key={kind}
              role="menuitem"
              type="button"
              autoFocus={i === 0}
              onClick={() => onPick(kind)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: `${meta.color}14`, color: meta.color }}>
                <Icon size={15} />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[13px] font-medium text-gray-800">{meta.label}</span>
                <span className="block truncate text-[11px] text-gray-400">{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

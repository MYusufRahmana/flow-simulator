import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useFocusNode } from '../../hooks/useFocusNode';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUiStore } from '../../stores/uiStore';
import { formatClock } from '../../utils/misc';
import { IconButton } from '../common/ui';

const DOT = {
  info: 'bg-blue-400',
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warn: 'bg-amber-400',
} as const;

export default function SimulationLog() {
  const logs = useSimulationStore((s) => s.logs);
  const open = useUiStore((s) => s.logOpen);
  const setOpen = useUiStore((s) => s.setLogOpen);
  const listRef = useRef<HTMLOListElement>(null);
  const focusNode = useFocusNode();

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length, open]);

  return (
    <section aria-label="Simulation log" className="panel pointer-events-auto w-[440px] max-w-[calc(100vw-24px)] overflow-hidden">
      <header className="flex h-10 items-center gap-2 pr-1 pl-3">
        <ScrollText size={15} className="text-gray-400" />
        <span className="text-[12px] font-semibold tracking-wider text-gray-500 uppercase">Simulation log</span>
        <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-medium text-gray-500">{logs.length}</span>
        <span className="flex-1" />
        <IconButton label={open ? 'Collapse log' : 'Expand log'} className="!h-8 !w-8" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </IconButton>
      </header>
      {open && (
        <ol ref={listRef} className="scroll-thin max-h-[200px] overflow-y-auto border-t border-black/6 py-1" aria-live="polite">
          {logs.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                disabled={!l.nodeId}
                onClick={() => l.nodeId && focusNode(l.nodeId)}
                className="flex w-full items-start gap-2.5 px-3 py-1 text-left text-[12.5px] hover:bg-gray-50 disabled:hover:bg-transparent"
              >
                <span className="pt-px font-mono text-[11px] text-gray-400 tabular-nums">{formatClock(l.t)}</span>
                <span className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[l.level]}`} />
                <span className={l.level === 'error' ? 'text-red-700' : l.level === 'success' ? 'font-medium text-emerald-700' : 'text-gray-700'}>
                  {l.text}
                </span>
              </button>
            </li>
          ))}
          {!logs.length && <li className="px-3 py-2 text-[12px] text-gray-400">Press Play to start.</li>}
        </ol>
      )}
    </section>
  );
}

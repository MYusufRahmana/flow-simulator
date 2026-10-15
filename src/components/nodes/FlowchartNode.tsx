import { Handle, Position, useConnection, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AUTO_HANDLE } from '../../features/editor/connect';
import { useFlowStore } from '../../stores/flowStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUiStore } from '../../stores/uiStore';
import type { FlowNode, NodeKind, TextSize } from '../../types/flow';
import { FLOWCHART_SIZE, NODE_META } from './registry';

const BRAND = '#2f5bff';

/** Outline drawn in a 100×100 box and stretched to the node size. */
function SvgShape({ kind, stroke, fill, width }: { kind: NodeKind; stroke: string; fill: string; width: number }) {
  const common = { fill, stroke, strokeWidth: width, vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const };
  let shape: ReactNode = null;
  switch (kind) {
    case 'fc-decision':
      shape = <polygon points="50,1 99,50 50,99 1,50" {...common} />;
      break;
    case 'fc-data':
      shape = <polygon points="14,1 99,1 86,99 1,99" {...common} />;
      break;
    case 'fc-document':
      shape = <path d="M1 1 H99 V84 C80 72 64 98 44 92 C28 87 14 82 1 90 Z" {...common} />;
      break;
    case 'fc-database':
      shape = (
        <>
          <path d="M1 12 A49 11 0 0 1 99 12 V88 A49 11 0 0 1 1 88 Z" {...common} />
          <path d="M1 12 A49 11 0 0 0 99 12" {...common} fill="none" />
        </>
      );
      break;
  }
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {shape}
    </svg>
  );
}

const SVG_KINDS: NodeKind[] = ['fc-decision', 'fc-data', 'fc-document', 'fc-database'];

/** Simple person: round head over rounded shoulders. */
function PersonFigure({ stroke, fill, width }: { stroke: string; fill: string; width: number }) {
  return (
    <svg className="pointer-events-none mb-1 h-[58px] w-[52px] shrink-0 overflow-visible" viewBox="0 0 52 58" aria-hidden>
      <circle cx="26" cy="14" r="12" fill={fill} stroke={stroke} strokeWidth={width} />
      <path d="M3 57 V48 C3 36 13 30 26 30 C39 30 49 36 49 48 V57 Z" fill={fill} stroke={stroke} strokeWidth={width} strokeLinejoin="round" />
    </svg>
  );
}

/** Inner padding so the label stays inside the visible outline. */
const PADDING: Partial<Record<NodeKind, string>> = {
  'fc-terminal': '6px 22px',
  'fc-actor': '0',
  'fc-process': '8px 14px',
  'fc-decision': '18px 34px',
  'fc-data': '8px 28px',
  'fc-document': '8px 14px 18px',
  'fc-database': '24px 12px 12px',
  'fc-subprocess': '8px 26px',
  'fc-connector': '4px',
  'fc-note': '10px 14px 10px 12px',
};

/**
 * Textarea that replaces a shape's label while it is being edited.
 * Enter saves, Shift+Enter adds a line, Esc cancels, clicking elsewhere saves.
 */
function InlineEditor({ id, value, className, style }: { id: string; value: string; className?: string; style?: CSSProperties }) {
  const seed = useUiStore((s) => s.editing?.seed);
  const [text, setText] = useState(seed ?? value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el || document.activeElement === el) return;
      el.focus();
      if (seed === undefined) el.select();
      else el.setSelectionRange(el.value.length, el.value.length);
    };
    place();
    // A brand-new node stays hidden until React Flow has measured it, and hidden elements cannot take focus.
    let frame = requestAnimationFrame(() => {
      place();
      frame = requestAnimationFrame(place);
    });
    return () => cancelAnimationFrame(frame);
  }, [seed]);

  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (save && text !== value) useFlowStore.getState().updateNodeData(id, { label: text });
    useUiStore.getState().stopEditing();
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={text}
      spellCheck={false}
      aria-label="Edit text"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      }}
      className={`nodrag nopan nowheel relative block resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ${className ?? ''}`}
      style={{ fieldSizing: 'content', font: 'inherit', color: 'inherit', textAlign: 'inherit', ...style } as CSSProperties}
    />
  );
}

/** Double-click a shape to edit its text. Listens natively so the canvas does not also zoom in. */
function useDoubleClickToEdit(id: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDblClick = (e: MouseEvent) => {
      e.stopPropagation();
      if (!useSimulationStore.getState().active) useUiStore.getState().startEditing(id);
    };
    el.addEventListener('dblclick', onDblClick);
    return () => el.removeEventListener('dblclick', onDblClick);
  }, [id]);
  return ref;
}

const TEXT_SIZE: Record<TextSize, string> = { sm: '12px', md: '14px', lg: '20px', xl: '28px' };

/** Free text on the canvas: no outline, no connections, sized to its content. */
function TextNode({ id, data, selected }: Pick<NodeProps<FlowNode>, 'id' | 'data' | 'selected'>) {
  const c = data.config ?? {};
  const size = c.textSize ?? 'md';
  const editing = useUiStore((s) => s.editing?.nodeId === id);
  const ref = useDoubleClickToEdit(id);
  return (
    <div
      ref={ref}
      className="fc-node fc-text rounded px-1.5 py-0.5"
      style={{
        minWidth: 48,
        maxWidth: 560,
        width: 'max-content',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        color: c.color || NODE_META['fc-text'].color,
        fontSize: TEXT_SIZE[size],
        lineHeight: 1.3,
        fontWeight: c.bold || size === 'xl' ? 700 : size === 'lg' ? 600 : 400,
        textAlign: c.textAlign ?? 'left',
        outline: selected ? `1.5px dashed ${BRAND}` : undefined,
        outlineOffset: 2,
      }}
      title={data.description}
    >
      {editing ? (
        <InlineEditor id={id} value={data.label} style={{ minWidth: 40, lineHeight: 'inherit', fontWeight: 'inherit' }} />
      ) : (
        data.label || <span className="text-gray-400 italic">Teks</span>
      )}
    </div>
  );
}

function FlowchartNode(props: NodeProps<FlowNode>) {
  if (props.type === 'fc-text') return <TextNode id={props.id} data={props.data} selected={props.selected} />;
  return <FlowchartShape {...props} />;
}

function FlowchartShape({ id, type, data, selected }: NodeProps<FlowNode>) {
  const meta = NODE_META[type];
  const color = data.config?.color || meta.color;
  const size = FLOWCHART_SIZE[type] ?? { w: 180, h: 64 };
  const isNote = type === 'fc-note';
  const isActor = type === 'fc-actor';
  const stroke = selected ? BRAND : color;
  const strokeWidth = selected ? 2.25 : 1.5;
  const fill = isNote ? '#fef9c3' : `color-mix(in srgb, ${color} 7%, white)`;
  const dropTarget = useConnection((c) => c.inProgress && c.fromNode.id !== id && c.fromHandle.type === 'source');
  const editing = useUiStore((s) => s.editing?.nodeId === id);
  const ref = useDoubleClickToEdit(id);

  const box: CSSProperties = {
    width: size.w,
    minHeight: size.h,
    padding: PADDING[type],
    color: '#1c1d22',
  };
  if (isActor) {
    box.justifyContent = 'flex-start';
  } else if (!SVG_KINDS.includes(type)) {
    box.background = fill;
    box.border = `${strokeWidth}px solid ${isNote ? (selected ? BRAND : '#eab308') : stroke}`;
    box.borderRadius = type === 'fc-terminal' ? 9999 : type === 'fc-connector' ? '50%' : isNote ? 4 : 8;
    if (type === 'fc-connector') box.height = size.h;
    if (selected) box.boxShadow = `0 0 0 3px ${BRAND}26`;
  }

  return (
    <div
      ref={ref}
      className={`fc-node relative flex flex-col items-center justify-center text-center ${isNote ? '!items-start text-left' : ''} ${
        SVG_KINDS.includes(type) || isActor ? '' : 'shadow-[0_1px_2px_rgb(16_24_40/0.06)]'
      }`}
      style={box}
      title={data.description}
    >
      {SVG_KINDS.includes(type) && <SvgShape kind={type} stroke={stroke} fill={fill} width={strokeWidth} />}
      {isActor && <PersonFigure stroke={stroke} fill={`color-mix(in srgb, ${color} 14%, white)`} width={selected ? 2.5 : 2} />}
      {type === 'fc-subprocess' && (
        <>
          <span className="pointer-events-none absolute top-0 bottom-0 left-[12px]" style={{ borderLeft: `${strokeWidth}px solid ${stroke}` }} />
          <span className="pointer-events-none absolute top-0 right-[12px] bottom-0" style={{ borderLeft: `${strokeWidth}px solid ${stroke}` }} />
        </>
      )}
      {isNote && (
        <span
          className="pointer-events-none absolute top-0 right-0 h-3 w-3"
          style={{ background: 'linear-gradient(225deg, var(--color-canvas) 50%, #fde047 50%)' }}
        />
      )}

      {dropTarget && <Handle id={AUTO_HANDLE} type="target" position={Position.Top} className="handle-dropzone" />}
      <Handle id="top" type="target" position={Position.Top} />
      <Handle id="left" type="target" position={Position.Left} />
      <Handle id="right" type="target" position={Position.Right} />

      <span
        className={`relative block w-full break-words whitespace-pre-wrap leading-snug ${
          type === 'fc-connector' ? 'text-[15px] font-bold' : isNote ? 'text-[12.5px] text-gray-700' : 'text-[13px] font-semibold'
        }`}
        title={editing ? undefined : 'Double-click to edit'}
      >
        {editing ? <InlineEditor id={id} value={data.label} className="w-full" /> : data.label || (isNote ? '' : meta.label)}
      </span>
      {data.description && type !== 'fc-connector' && !isNote && (
        <span className="relative mt-0.5 line-clamp-2 block w-full text-[11px] leading-snug text-gray-500">{data.description}</span>
      )}

      {type === 'fc-decision' ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} className="handle-true" title="Ya" />
          <Handle id="false" type="source" position={Position.Right} className="handle-false" title="Tidak" />
        </>
      ) : (
        <>
          <Handle id="out" type="source" position={Position.Bottom} />
          <Handle id="out-right" type="source" position={Position.Right} />
        </>
      )}
    </div>
  );
}

export default memo(FlowchartNode);

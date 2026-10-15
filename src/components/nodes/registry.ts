import {
  AppWindow,
  Bell,
  Circle,
  CircleStop,
  Cog,
  Database,
  Diamond,
  FileOutput,
  FileText,
  Globe,
  Pill,
  Play,
  Plug,
  RectangleHorizontal,
  Server,
  Split,
  SquareSplitHorizontal,
  StickyNote,
  TextCursorInput,
  TriangleAlert,
  Type,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { FlowNode, FlowNodeData, NodeCategory, NodeKind } from '../../types/flow';

export type NodeMeta = {
  kind: NodeKind;
  label: string;
  hint: string;
  category: NodeCategory;
  group: 'Flow' | 'Frontend' | 'Logic' | 'Server' | 'Result' | 'Basic' | 'Data' | 'Other';
  icon: LucideIcon;
  /** Accent colour (used for the icon tile, minimap and palette). */
  color: string;
  /** Whether this node can be forced to fail and exposes a FAILED handle. */
  canFail: boolean;
  defaults: () => FlowNodeData;
};

export const NODE_META: Record<NodeKind, NodeMeta> = {
  start: {
    kind: 'start',
    label: 'Start',
    hint: 'Entry point of the flow',
    category: 'simulation',
    group: 'Flow',
    icon: Play,
    color: '#16a34a',
    canFail: false,
    defaults: () => ({ label: 'Start', duration: 300, payload: '' }),
  },
  end: {
    kind: 'end',
    label: 'End',
    hint: 'Flow finishes here',
    category: 'simulation',
    group: 'Flow',
    icon: CircleStop,
    color: '#334155',
    canFail: false,
    defaults: () => ({ label: 'End', duration: 300 }),
  },
  input: {
    kind: 'input',
    label: 'User Input',
    hint: 'Form, upload, submit',
    category: 'simulation',
    group: 'Frontend',
    icon: TextCursorInput,
    color: '#0284c7',
    canFail: true,
    defaults: () => ({ label: 'Input Form', duration: 700, config: { fields: 'name, email' } }),
  },
  page: {
    kind: 'page',
    label: 'Page / UI',
    hint: 'Screen the user sees',
    category: 'simulation',
    group: 'Frontend',
    icon: AppWindow,
    color: '#4f46e5',
    canFail: false,
    defaults: () => ({ label: 'Dashboard', duration: 500, config: { route: '/dashboard' } }),
  },
  process: {
    kind: 'process',
    label: 'Process',
    hint: 'Validate, transform, assign',
    category: 'simulation',
    group: 'Logic',
    icon: Cog,
    color: '#2563eb',
    canFail: true,
    defaults: () => ({ label: 'Validate Form', duration: 600 }),
  },
  decision: {
    kind: 'decision',
    label: 'Decision',
    hint: 'TRUE / FALSE branch',
    category: 'simulation',
    group: 'Logic',
    icon: Split,
    color: '#d97706',
    canFail: false,
    defaults: () => ({ label: 'Is valid?', duration: 500, config: { condition: 'payload.valid', outcome: 'TRUE' } }),
  },
  api: {
    kind: 'api',
    label: 'API Request',
    hint: 'HTTP call to a service',
    category: 'simulation',
    group: 'Server',
    icon: Globe,
    color: '#7c3aed',
    canFail: true,
    defaults: () => ({
      label: 'Create User',
      duration: 900,
      config: { method: 'POST', endpoint: '/api/users', statusCode: 201, response: '{\n  "id": 1\n}' },
    }),
  },
  backend: {
    kind: 'backend',
    label: 'Backend',
    hint: 'Controller / service',
    category: 'simulation',
    group: 'Server',
    icon: Server,
    color: '#0d9488',
    canFail: true,
    defaults: () => ({ label: 'UserController', duration: 700, config: { handler: 'store()' } }),
  },
  database: {
    kind: 'database',
    label: 'Database',
    hint: 'Query or transaction',
    category: 'simulation',
    group: 'Server',
    icon: Database,
    color: '#ea580c',
    canFail: true,
    defaults: () => ({
      label: 'Save user',
      duration: 700,
      config: { database: 'app_db', table: 'users', action: 'INSERT' },
    }),
  },
  external: {
    kind: 'external',
    label: 'External Service',
    hint: 'Third-party API',
    category: 'simulation',
    group: 'Server',
    icon: Plug,
    color: '#db2777',
    canFail: true,
    defaults: () => ({ label: 'Payment Gateway', duration: 1000, config: { service: 'Midtrans' } }),
  },
  notification: {
    kind: 'notification',
    label: 'Notification',
    hint: 'Email, push, WhatsApp',
    category: 'simulation',
    group: 'Result',
    icon: Bell,
    color: '#ca8a04',
    canFail: true,
    defaults: () => ({ label: 'Send Email', duration: 600, config: { channel: 'Email' } }),
  },
  output: {
    kind: 'output',
    label: 'Output',
    hint: 'Response or result',
    category: 'simulation',
    group: 'Result',
    icon: FileOutput,
    color: '#059669',
    canFail: false,
    defaults: () => ({ label: '201 Created', duration: 400 }),
  },
  error: {
    kind: 'error',
    label: 'Error',
    hint: 'Failure state',
    category: 'simulation',
    group: 'Result',
    icon: TriangleAlert,
    color: '#dc2626',
    canFail: false,
    defaults: () => ({ label: 'Validation Error', duration: 400, config: { code: '422' } }),
  },

  'fc-terminal': {
    kind: 'fc-terminal',
    label: 'Terminator',
    hint: 'Mulai / selesai',
    category: 'flowchart',
    group: 'Basic',
    icon: Pill,
    color: '#16a34a',
    canFail: false,
    defaults: () => ({ label: 'Mulai' }),
  },
  'fc-actor': {
    kind: 'fc-actor',
    label: 'User',
    hint: 'Orang / aktor / peran',
    category: 'flowchart',
    group: 'Basic',
    icon: UserRound,
    color: '#4f46e5',
    canFail: false,
    defaults: () => ({ label: 'User' }),
  },
  'fc-process': {
    kind: 'fc-process',
    label: 'Process',
    hint: 'Langkah / aktivitas',
    category: 'flowchart',
    group: 'Basic',
    icon: RectangleHorizontal,
    color: '#2563eb',
    canFail: false,
    defaults: () => ({ label: 'Proses' }),
  },
  'fc-decision': {
    kind: 'fc-decision',
    label: 'Decision',
    hint: 'Percabangan Ya / Tidak',
    category: 'flowchart',
    group: 'Basic',
    icon: Diamond,
    color: '#d97706',
    canFail: false,
    defaults: () => ({ label: 'Disetujui?' }),
  },
  'fc-data': {
    kind: 'fc-data',
    label: 'Input / Output',
    hint: 'Data masuk atau keluar',
    category: 'flowchart',
    group: 'Data',
    icon: TextCursorInput,
    color: '#0284c7',
    canFail: false,
    defaults: () => ({ label: 'Input Data' }),
  },
  'fc-document': {
    kind: 'fc-document',
    label: 'Document',
    hint: 'Dokumen / laporan',
    category: 'flowchart',
    group: 'Data',
    icon: FileText,
    color: '#7c3aed',
    canFail: false,
    defaults: () => ({ label: 'Dokumen' }),
  },
  'fc-database': {
    kind: 'fc-database',
    label: 'Database',
    hint: 'Penyimpanan data',
    category: 'flowchart',
    group: 'Data',
    icon: Database,
    color: '#ea580c',
    canFail: false,
    defaults: () => ({ label: 'Database' }),
  },
  'fc-subprocess': {
    kind: 'fc-subprocess',
    label: 'Subprocess',
    hint: 'Proses yang sudah terdefinisi',
    category: 'flowchart',
    group: 'Other',
    icon: SquareSplitHorizontal,
    color: '#0d9488',
    canFail: false,
    defaults: () => ({ label: 'Sub Proses' }),
  },
  'fc-connector': {
    kind: 'fc-connector',
    label: 'Connector',
    hint: 'Penghubung antar bagian',
    category: 'flowchart',
    group: 'Other',
    icon: Circle,
    color: '#475569',
    canFail: false,
    defaults: () => ({ label: 'A' }),
  },
  'fc-text': {
    kind: 'fc-text',
    label: 'Text',
    hint: 'Judul / teks bebas',
    category: 'flowchart',
    group: 'Other',
    icon: Type,
    color: '#1c1d22',
    canFail: false,
    defaults: () => ({ label: 'Teks', config: { textSize: 'md', textAlign: 'left' } }),
  },
  'fc-note': {
    kind: 'fc-note',
    label: 'Note',
    hint: 'Catatan / keterangan',
    category: 'flowchart',
    group: 'Other',
    icon: StickyNote,
    color: '#ca8a04',
    canFail: false,
    defaults: () => ({ label: 'Catatan' }),
  },
};

export type NodeGroup = { name: NodeMeta['group']; kinds: NodeKind[] };

export const NODE_CATEGORIES: { id: NodeCategory; name: string; hint: string; groups: NodeGroup[] }[] = [
  {
    id: 'simulation',
    name: 'Simulasi',
    hint: 'Flow teknis yang bisa disimulasikan (API, payload, database).',
    groups: [
      { name: 'Flow', kinds: ['start', 'end'] },
      { name: 'Frontend', kinds: ['input', 'page'] },
      { name: 'Logic', kinds: ['process', 'decision'] },
      { name: 'Server', kinds: ['api', 'backend', 'database', 'external'] },
      { name: 'Result', kinds: ['notification', 'output', 'error'] },
    ],
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    hint: 'Bentuk flowchart untuk presentasi. Animasi garis berjalan otomatis.',
    groups: [
      { name: 'Basic', kinds: ['fc-terminal', 'fc-actor', 'fc-process', 'fc-decision'] },
      { name: 'Data', kinds: ['fc-data', 'fc-document', 'fc-database'] },
      { name: 'Other', kinds: ['fc-subprocess', 'fc-connector', 'fc-note', 'fc-text'] },
    ],
  },
];

export const NODE_KINDS = Object.keys(NODE_META) as NodeKind[];

export function categoryOf(kind: string | undefined): NodeCategory {
  return (kind && NODE_META[kind as NodeKind]?.category) || 'simulation';
}

export function isFlowchartKind(kind: string | undefined): boolean {
  return categoryOf(kind) === 'flowchart';
}

export function kindsInCategory(category: NodeCategory): NodeKind[] {
  return NODE_CATEGORIES.find((c) => c.id === category)!.groups.flatMap((g) => g.kinds);
}

/**
 * Default size of each flowchart shape. Every size is a multiple of 24 so a shape's centre always lands
 * on the 12px snap grid — two shapes dragged roughly level line up exactly and their connection runs straight.
 */
export const FLOWCHART_SIZE: Partial<Record<NodeKind, { w: number; h: number }>> = {
  'fc-terminal': { w: 168, h: 48 },
  'fc-actor': { w: 120, h: 96 },
  'fc-process': { w: 192, h: 72 },
  'fc-decision': { w: 168, h: 120 },
  'fc-data': { w: 192, h: 72 },
  'fc-document': { w: 192, h: 72 },
  'fc-database': { w: 144, h: 96 },
  'fc-subprocess': { w: 192, h: 72 },
  'fc-connector': { w: 48, h: 48 },
  'fc-note': { w: 192, h: 72 },
  'fc-text': { w: 96, h: 24 },
};

/** Half the default width of a node, used to centre a freshly placed node on a point. */
export function halfWidthOf(kind: NodeKind): number {
  const fc = FLOWCHART_SIZE[kind];
  if (fc) return fc.w / 2;
  return kind === 'start' || kind === 'end' ? 80 : 116;
}

/** One-line technical summary shown under the node label. */
export function nodeSubtitle(node: Pick<FlowNode, 'type' | 'data'>): string | undefined {
  const c = node.data.config ?? {};
  switch (node.type) {
    case 'api':
      return [c.method, c.endpoint].filter(Boolean).join(' ') || undefined;
    case 'database':
      return [c.action, c.table].filter(Boolean).join(' · ') || undefined;
    case 'decision':
      return c.condition || undefined;
    case 'input':
      return c.fields ? `fields: ${c.fields}` : undefined;
    case 'page':
      return c.route || undefined;
    case 'backend':
      return c.handler || undefined;
    case 'external':
      return c.service || undefined;
    case 'notification':
      return c.channel || undefined;
    case 'error':
      return c.code ? `code ${c.code}` : undefined;
    default:
      return node.data.description || undefined;
  }
}

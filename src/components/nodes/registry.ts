import {
  AppWindow,
  Bell,
  CircleStop,
  Cog,
  Database,
  FileOutput,
  Globe,
  Play,
  Plug,
  Server,
  Split,
  TextCursorInput,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { FlowNode, FlowNodeData, NodeKind } from '../../types/flow';

export type NodeMeta = {
  kind: NodeKind;
  label: string;
  hint: string;
  group: 'Flow' | 'Frontend' | 'Logic' | 'Server' | 'Result';
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
    group: 'Result',
    icon: TriangleAlert,
    color: '#dc2626',
    canFail: false,
    defaults: () => ({ label: 'Validation Error', duration: 400, config: { code: '422' } }),
  },
};

export const NODE_GROUPS: { name: NodeMeta['group']; kinds: NodeKind[] }[] = [
  { name: 'Flow', kinds: ['start', 'end'] },
  { name: 'Frontend', kinds: ['input', 'page'] },
  { name: 'Logic', kinds: ['process', 'decision'] },
  { name: 'Server', kinds: ['api', 'backend', 'database', 'external'] },
  { name: 'Result', kinds: ['notification', 'output', 'error'] },
];

export const NODE_KINDS = Object.keys(NODE_META) as NodeKind[];

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

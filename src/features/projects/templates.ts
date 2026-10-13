import { NODE_META } from '../../components/nodes/registry';
import type { Branch, FlowEdge, FlowNode, FlowNodeData, FlowProject, NodeKind } from '../../types/flow';
import { createEmptyProject } from './io';

type NodeSpec = [id: string, kind: NodeKind, col: number, row: number, data?: Partial<FlowNodeData>];
/** `label` 'left' / 'right' is shorthand for "enter the target from that side" with no label. */
type EdgeSpec = [source: string, target: string, branch?: Branch, label?: string];

const COL = 300;
const ROW = 120;
const TERMINAL_OFFSET = (232 - 160) / 2;

export type Template = {
  id: string;
  name: string;
  description: string;
  kinds: NodeKind[];
  build: () => FlowProject;
};

function sourceHandleFor(branch?: Branch) {
  if (branch === 'TRUE') return 'true';
  if (branch === 'FALSE') return 'false';
  if (branch === 'FAILED') return 'fail';
  return 'out';
}

function build(name: string, description: string, nodeSpecs: NodeSpec[], edgeSpecs: EdgeSpec[]): FlowProject {
  const project = createEmptyProject(name);
  project.description = description;
  const kindOf = new Map(nodeSpecs.map(([id, kind]) => [id, kind]));
  project.nodes = nodeSpecs.map(([id, kind, col, row, data]): FlowNode => {
    const defaults = NODE_META[kind].defaults();
    return {
      id,
      type: kind,
      // Start/End pills are narrower than cards; centre them on the column.
      position: { x: col * COL + (kind === 'start' || kind === 'end' ? TERMINAL_OFFSET : 0), y: row * ROW },
      data: { ...defaults, ...data, config: { ...defaults.config, ...data?.config } },
    };
  });
  project.edges = edgeSpecs.map(([source, target, branch, label], i): FlowEdge => {
    const sideways = branch === 'FALSE' || branch === 'FAILED';
    const fromDecision = kindOf.get(source) === 'decision';
    return {
      id: `e${i + 1}`,
      type: 'flow',
      source,
      target,
      sourceHandle: fromDecision && !branch ? 'true' : sourceHandleFor(branch),
      targetHandle: label === 'right' ? 'right' : sideways || label === 'left' ? 'left' : 'top',
      data: { branch, label: label === 'left' || label === 'right' ? undefined : label ?? branch?.toLowerCase() },
    };
  });
  return project;
}

export const TEMPLATES: Template[] = [
  {
    id: 'login',
    name: 'Login Flow',
    description: 'Interactive decision — you choose whether the credentials are valid.',
    kinds: ['start', 'page', 'input', 'api', 'decision', 'error', 'end'],
    build: () =>
      build(
        'Login Flow',
        'User logs in; the decision asks you which branch to take.',
        [
          ['start', 'start', 0, 0, { label: 'Open App' }],
          ['login', 'page', 0, 1, { label: 'Login Page', config: { route: '/login' } }],
          [
            'submit',
            'input',
            0,
            2,
            {
              label: 'Submit Credentials',
              config: { fields: 'email, password' },
              payload: '{\n  "email": "yusuf@example.com",\n  "password": "••••••••"\n}',
            },
          ],
          [
            'api',
            'api',
            0,
            3,
            {
              label: 'Login API',
              config: {
                method: 'POST',
                endpoint: '/api/login',
                statusCode: 200,
                response: '{\n  "token": "eyJhbGciOi…",\n  "user": { "id": 7, "name": "Yusuf" }\n}',
              },
            },
          ],
          ['valid', 'decision', 0, 4, { label: 'Credential valid?', config: { condition: 'response.token', outcome: 'ASK' } }],
          ['dash', 'page', 0, 5, { label: 'Dashboard', config: { route: '/dashboard' } }],
          ['err', 'error', 1, 5, { label: 'Unauthorized', config: { code: '401' } }],
          ['end', 'end', 0, 6.4, { label: 'End' }],
        ],
        [
          ['start', 'login'],
          ['login', 'submit'],
          ['submit', 'api', undefined, 'submit'],
          ['api', 'valid'],
          ['valid', 'dash', 'TRUE'],
          ['valid', 'err', 'FALSE'],
          ['dash', 'end'],
          ['err', 'end', undefined, 'right'],
        ],
      ),
  },
  {
    id: 'api',
    name: 'Create User API',
    description: 'Frontend → API → controller → service → database, with a validation failure path.',
    kinds: ['input', 'process', 'api', 'backend', 'database', 'output', 'error'],
    build: () =>
      build(
        'Create User API',
        'A classic REST create flow.',
        [
          ['start', 'start', 0, 0],
          [
            'input',
            'input',
            0,
            1,
            { label: 'User Input', payload: '{\n  "name": "Yusuf",\n  "email": "yusuf@example.com"\n}' },
          ],
          ['fe', 'process', 0, 2, { label: 'Frontend Validation' }],
          [
            'api',
            'api',
            0,
            3,
            { label: 'Create User', config: { method: 'POST', endpoint: '/api/users', statusCode: 201, response: '{\n  "id": 42\n}' } },
          ],
          ['ctrl', 'backend', 0, 4, { label: 'UserController', config: { handler: 'store()' } }],
          ['rv', 'process', 0, 5, { label: 'Request Validation', description: 'Toggle “Simulate failure” to see the 422 path' }],
          ['svc', 'backend', 0, 6, { label: 'UserService', config: { handler: 'create()' } }],
          ['db', 'database', 0, 7, { label: 'Insert user', config: { database: 'app_db', table: 'users', action: 'INSERT' } }],
          ['ok', 'output', 0, 8, { label: '201 Created' }],
          ['msg', 'page', 0, 9, { label: 'Success Message', config: { route: '/users' } }],
          ['e422', 'error', 1, 6, { label: 'Validation Error', config: { code: '422' } }],
          ['end', 'end', 0, 10],
        ],
        [
          ['start', 'input'],
          ['input', 'fe', undefined, 'submit'],
          ['fe', 'api'],
          ['api', 'ctrl'],
          ['ctrl', 'rv'],
          ['rv', 'svc'],
          ['rv', 'e422', 'FAILED'],
          ['svc', 'db'],
          ['db', 'ok'],
          ['ok', 'msg'],
          ['msg', 'end'],
          ['e422', 'end', undefined, 'right'],
        ],
      ),
  },
  {
    id: 'legal',
    name: 'Legal Incoming Letter',
    description: 'Surat masuk → API → assignment service → jobdesk → activity log.',
    kinds: ['page', 'input', 'api', 'backend', 'database', 'notification', 'output'],
    build: () =>
      build(
        'Legal Incoming Letter Flow',
        'Incoming letter registration and PIC assignment.',
        [
          ['start', 'start', 0, 0, { label: 'User' }],
          ['create', 'page', 0, 1, { label: 'Create Surat Masuk', config: { route: '/incoming-letters/create' } }],
          [
            'pic',
            'input',
            0,
            2,
            {
              label: 'Select PIC',
              config: { fields: 'letter_no, pic_id' },
              payload: '{\n  "letter_no": "SM/2026/001",\n  "pic_id": 12\n}',
            },
          ],
          [
            'api',
            'api',
            0,
            3,
            { label: 'Store Letter', config: { method: 'POST', endpoint: '/incoming-letters', statusCode: 201, response: '{\n  "letter_id": 381\n}' } },
          ],
          ['ctrl', 'backend', 0, 4, { label: 'IncomingLetterController', config: { handler: 'store()' } }],
          ['svc', 'backend', 0, 5, { label: 'IncomingLetterAssignmentService', config: { handler: 'assign()' } }],
          ['letter', 'database', 0, 6, { label: 'Create Incoming Letter', config: { table: 'incoming_letters', action: 'INSERT', database: 'legal' } }],
          ['job', 'database', 0, 7, { label: 'Create Jobdesk', config: { table: 'jobdesks', action: 'INSERT', database: 'legal' } }],
          ['assign', 'database', 0, 8, { label: 'Assign PIC', config: { table: 'jobdesks', action: 'UPDATE', database: 'legal' } }],
          ['notify', 'notification', 1, 8, { label: 'Notify PIC', config: { channel: 'Email' } }],
          ['log', 'database', 0, 9, { label: 'Activity Log', config: { table: 'activity_logs', action: 'INSERT', database: 'legal' } }],
          ['res', 'output', 0, 10, { label: 'Response 201' }],
          ['end', 'end', 0, 11],
        ],
        [
          ['start', 'create'],
          ['create', 'pic'],
          ['pic', 'api', undefined, 'submit'],
          ['api', 'ctrl'],
          ['ctrl', 'svc'],
          ['svc', 'letter'],
          ['letter', 'job'],
          ['job', 'assign'],
          ['assign', 'log'],
          ['assign', 'notify', undefined, 'left'],
          ['log', 'res'],
          ['res', 'end'],
        ],
      ),
  },
  {
    id: 'bast',
    name: 'Inventory BAST',
    description: 'BAST OUT with a stock availability check and database transaction.',
    kinds: ['page', 'input', 'database', 'decision', 'error', 'output'],
    build: () =>
      build(
        'Inventory BAST Flow',
        'Hand-over of an asset (BAST OUT).',
        [
          ['start', 'start', 0, 0, { label: 'Admin' }],
          ['page', 'page', 0, 1, { label: 'Create BAST OUT', config: { route: '/bast/create' } }],
          [
            'asset',
            'input',
            0,
            2,
            { label: 'Select Stock Asset', config: { fields: 'asset_id' }, payload: '{\n  "asset_id": "AST-0192",\n  "type": "OUT"\n}' },
          ],
          ['load', 'database', 0, 3, { label: 'Load asset', config: { table: 'assets', action: 'SELECT', database: 'inventory' } }],
          ['avail', 'decision', 0, 4, { label: 'Asset AVAILABLE?', config: { condition: "asset.status == 'AVAILABLE'", outcome: 'TRUE' } }],
          ['bast', 'database', 0, 5, { label: 'Create BAST', config: { table: 'basts', action: 'TRANSACTION', database: 'inventory' } }],
          ['item', 'database', 0, 6, { label: 'Create BAST Item', config: { table: 'bast_items', action: 'INSERT', database: 'inventory' } }],
          ['out', 'database', 0, 7, { label: 'Update Asset → OUT', config: { table: 'assets', action: 'UPDATE', database: 'inventory' } }],
          ['hist', 'database', 0, 8, { label: 'Create History', config: { table: 'asset_histories', action: 'INSERT', database: 'inventory' } }],
          ['ok', 'output', 0, 9, { label: 'Success' }],
          ['na', 'error', 1, 5, { label: 'Asset not available', config: { code: '409' } }],
          ['end', 'end', 0, 10],
        ],
        [
          ['start', 'page'],
          ['page', 'asset'],
          ['asset', 'load'],
          ['load', 'avail'],
          ['avail', 'bast', 'TRUE'],
          ['avail', 'na', 'FALSE'],
          ['bast', 'item'],
          ['item', 'out'],
          ['out', 'hist'],
          ['hist', 'ok'],
          ['ok', 'end'],
          ['na', 'end', undefined, 'right'],
        ],
      ),
  },
];

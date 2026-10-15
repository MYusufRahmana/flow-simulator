import type { Edge, Node } from '@xyflow/react';

export type NodeKind =
  | 'start'
  | 'input'
  | 'page'
  | 'process'
  | 'decision'
  | 'api'
  | 'backend'
  | 'database'
  | 'external'
  | 'notification'
  | 'output'
  | 'error'
  | 'end'
  // Flowchart shapes: drawing only, never simulated.
  | 'fc-terminal'
  | 'fc-actor'
  | 'fc-process'
  | 'fc-decision'
  | 'fc-data'
  | 'fc-document'
  | 'fc-subprocess'
  | 'fc-database'
  | 'fc-connector'
  | 'fc-note'
  | 'fc-text';

export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type NodeCategory = 'simulation' | 'flowchart';

export type Branch = 'TRUE' | 'FALSE' | 'SUCCESS' | 'FAILED';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type DbAction = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION';
export type DecisionOutcome = 'TRUE' | 'FALSE' | 'ASK';

/** Type-specific settings. Every field is optional so one shape fits all node kinds. */
export type NodeConfig = {
  /** Force this node to fail during simulation (follows the FAILED path). */
  fail?: boolean;
  // input
  fields?: string;
  // page
  route?: string;
  // decision
  condition?: string;
  outcome?: DecisionOutcome;
  // api
  method?: HttpMethod;
  endpoint?: string;
  statusCode?: number;
  response?: string;
  // backend
  handler?: string;
  // database
  database?: string;
  table?: string;
  action?: DbAction;
  // external / notification
  service?: string;
  channel?: string;
  // error
  code?: string;
  // flowchart shapes
  color?: string;
  // text
  textSize?: TextSize;
  textAlign?: 'left' | 'center' | 'right';
  bold?: boolean;
};

export type FlowNodeData = {
  label: string;
  description?: string;
  /** Processing time in ms at 1x speed. */
  duration?: number;
  /** JSON source merged into the travelling payload when this node runs. */
  payload?: string;
  config?: NodeConfig;
};

export type FlowEdgeData = {
  label?: string;
  branch?: Branch;
  description?: string;
  animation?: boolean;
};

export type FlowNode = Node<FlowNodeData, NodeKind>;
export type FlowEdge = Edge<FlowEdgeData, 'flow'>;

export type Viewport = { x: number; y: number; zoom: number };

export type FlowProject = {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: Viewport;
  settings: {
    simulationSpeed: number;
  };
};

export type NodeRunStatus = 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
export type EdgeRunStatus = 'IDLE' | 'ACTIVE' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export type Payload = Record<string, unknown>;

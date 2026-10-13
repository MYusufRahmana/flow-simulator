import { NODE_KINDS } from '../../components/nodes/registry';
import type { Branch, FlowEdge, FlowNode, FlowProject } from '../../types/flow';
import { cleanEdges, cleanNodes, uid } from '../../utils/misc';

export const FILE_VERSION = 1;
export const FILE_EXT = '.flow.json';

export type ProjectFile = { version: number; project: FlowProject };

export function createEmptyProject(name = 'Untitled flow'): FlowProject {
  const now = new Date().toISOString();
  return {
    id: uid('prj'),
    name,
    version: FILE_VERSION,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    settings: { simulationSpeed: 1 },
  };
}

export function toFile(project: FlowProject): ProjectFile {
  return {
    version: FILE_VERSION,
    project: { ...project, nodes: cleanNodes(project.nodes), edges: cleanEdges(project.edges) },
  };
}

export function downloadProject(project: FlowProject) {
  const blob = new Blob([JSON.stringify(toFile(project), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'flow';
  a.href = url;
  a.download = `${slug}${FILE_EXT}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BRANCHES: Branch[] = ['TRUE', 'FALSE', 'SUCCESS', 'FAILED'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class ImportError extends Error {}

/**
 * Validate an untrusted .flow.json and return a fresh project ready to store.
 * Throws ImportError with a readable reason on anything malformed.
 */
export function parseProjectFile(text: string): FlowProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('File is not valid JSON.');
  }
  if (!isObj(raw) || typeof raw.version !== 'number' || !isObj(raw.project)) {
    throw new ImportError('Missing "version" or "project".');
  }
  if (raw.version > FILE_VERSION) throw new ImportError(`File version ${raw.version} is newer than this app supports.`);

  const p = raw.project;
  if (typeof p.name !== 'string') throw new ImportError('Project has no name.');
  if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) throw new ImportError('Project must contain nodes and edges.');

  const ids = new Set<string>();
  const nodes: FlowNode[] = p.nodes.map((n, i) => {
    if (!isObj(n) || typeof n.id !== 'string') throw new ImportError(`Node #${i + 1} has no id.`);
    if (ids.has(n.id)) throw new ImportError(`Duplicate node id "${n.id}".`);
    if (typeof n.type !== 'string' || !NODE_KINDS.includes(n.type as never))
      throw new ImportError(`Node "${n.id}" has unknown type "${String(n.type)}".`);
    const pos = n.position;
    if (!isObj(pos) || typeof pos.x !== 'number' || typeof pos.y !== 'number' || !isFinite(pos.x) || !isFinite(pos.y))
      throw new ImportError(`Node "${n.id}" has an invalid position.`);
    if (!isObj(n.data) || typeof n.data.label !== 'string') throw new ImportError(`Node "${n.id}" has no label.`);
    ids.add(n.id);
    const d = n.data;
    return {
      id: n.id,
      type: n.type as FlowNode['type'],
      position: { x: pos.x, y: pos.y },
      data: {
        label: d.label as string,
        description: typeof d.description === 'string' ? d.description : undefined,
        duration: typeof d.duration === 'number' ? Math.max(0, d.duration) : undefined,
        payload: typeof d.payload === 'string' ? d.payload : isObj(d.payload) ? JSON.stringify(d.payload, null, 2) : undefined,
        config: isObj(d.config) ? (d.config as FlowNode['data']['config']) : undefined,
      },
    };
  });

  const edgeIds = new Set<string>();
  const edges: FlowEdge[] = p.edges.map((e, i) => {
    if (!isObj(e) || typeof e.id !== 'string') throw new ImportError(`Connection #${i + 1} has no id.`);
    if (edgeIds.has(e.id)) throw new ImportError(`Duplicate connection id "${e.id}".`);
    if (typeof e.source !== 'string' || !ids.has(e.source) || typeof e.target !== 'string' || !ids.has(e.target))
      throw new ImportError(`Connection "${e.id}" references a missing node.`);
    edgeIds.add(e.id);
    const d = isObj(e.data) ? e.data : {};
    return {
      id: e.id,
      type: 'flow',
      source: e.source,
      target: e.target,
      sourceHandle: typeof e.sourceHandle === 'string' ? e.sourceHandle : null,
      targetHandle: typeof e.targetHandle === 'string' ? e.targetHandle : null,
      data: {
        label: typeof d.label === 'string' ? d.label : undefined,
        branch: BRANCHES.includes(d.branch as Branch) ? (d.branch as Branch) : undefined,
        description: typeof d.description === 'string' ? d.description : undefined,
        animation: typeof d.animation === 'boolean' ? d.animation : undefined,
      },
    };
  });

  const now = new Date().toISOString();
  const speed = isObj(p.settings) && typeof p.settings.simulationSpeed === 'number' ? p.settings.simulationSpeed : 1;
  const vp = p.viewport;
  return {
    id: uid('prj'),
    name: p.name.trim() || 'Imported flow',
    description: typeof p.description === 'string' ? p.description : undefined,
    version: FILE_VERSION,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : now,
    updatedAt: now,
    nodes,
    edges,
    viewport:
      isObj(vp) && typeof vp.x === 'number' && typeof vp.y === 'number' && typeof vp.zoom === 'number'
        ? { x: vp.x, y: vp.y, zoom: vp.zoom }
        : undefined,
    settings: { simulationSpeed: speed },
  };
}

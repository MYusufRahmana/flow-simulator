import { describe, expect, it } from 'vitest';
import { simulate } from '../simulation/engine';
import { validateFlow } from '../simulation/validation';
import { parseProjectFile } from './io';

const sources = import.meta.glob<string>('../../../examples/*.flow.json', { query: '?raw', import: 'default', eager: true });
const files = Object.keys(sources);

describe('example files in /examples', () => {
  it('exist', () => expect(files.length).toBeGreaterThan(0));

  it.each(files)('%s imports, validates and reaches End on every decision path', (file) => {
    const project = parseProjectFile(sources[file]);
    expect(validateFlow(project)).toEqual([]); // no errors and no warnings

    const decisions = project.nodes.filter((n) => n.type === 'decision').map((n) => n.id);
    for (const choice of ['TRUE', 'FALSE'] as const) {
      const run = simulate(project, Object.fromEntries(decisions.map((id) => [id, choice])));
      expect(run.reachedEnd, `${file} with decisions = ${choice}`).toBe(true);
    }

    // Forcing each failable node to fail must still end somewhere sensible.
    for (const n of project.nodes.filter((n) => n.type === 'process' || n.type === 'external')) {
      const failing = {
        ...project,
        nodes: project.nodes.map((m) => (m.id === n.id ? { ...m, data: { ...m.data, config: { ...m.data.config, fail: true } } } : m)),
      };
      expect(simulate(failing, {}).reachedEnd, `${file} with ${n.id} failing`).toBe(true);
    }
  });
});

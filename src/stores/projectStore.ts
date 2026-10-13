import { create } from 'zustand';
import { prefs, projectDb } from '../db/indexedDb';
import { createEmptyProject, parseProjectFile } from '../features/projects/io';
import { TEMPLATES } from '../features/projects/templates';
import type { FlowProject } from '../types/flow';
import { uid } from '../utils/misc';

type ProjectState = {
  projects: FlowProject[];
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  get: (id: string) => Promise<FlowProject | undefined>;
  create: (templateId?: string) => Promise<FlowProject>;
  save: (project: FlowProject) => Promise<FlowProject>;
  duplicate: (id: string) => Promise<FlowProject | undefined>;
  remove: (id: string) => Promise<void>;
  importFile: (text: string) => Promise<FlowProject>;
};

const sortByUpdated = (list: FlowProject[]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loaded: false,
  error: null,

  refresh: async () => {
    try {
      set({ projects: sortByUpdated(await projectDb.getAll()), loaded: true, error: null });
    } catch {
      set({ loaded: true, error: 'Browser storage is unavailable. Projects cannot be saved in this window.' });
    }
  },
  get: (id) => projectDb.get(id),

  create: async (templateId) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    const project = template ? template.build() : createEmptyProject();
    if (!template) {
      project.nodes = [
        { id: uid('start'), type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', duration: 300 } },
      ];
    }
    await projectDb.put(project);
    await get().refresh();
    return project;
  },

  save: async (project) => {
    const saved = { ...project, updatedAt: new Date().toISOString() };
    await projectDb.put(saved);
    prefs.set('lastOpenedProjectId', saved.id);
    set((s) => ({ projects: sortByUpdated([saved, ...s.projects.filter((p) => p.id !== saved.id)]) }));
    return saved;
  },

  duplicate: async (id) => {
    const original = await projectDb.get(id);
    if (!original) return undefined;
    const now = new Date().toISOString();
    const copy: FlowProject = { ...structuredClone(original), id: uid('prj'), name: `${original.name} (copy)`, createdAt: now, updatedAt: now };
    await projectDb.put(copy);
    await get().refresh();
    return copy;
  },

  remove: async (id) => {
    await projectDb.delete(id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  importFile: async (text) => {
    const project = parseProjectFile(text);
    await projectDb.put(project);
    await get().refresh();
    return project;
  },
}));

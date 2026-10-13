import { useCallback, useEffect, useRef } from 'react';
import { useFlowStore } from '../stores/flowStore';
import { useProjectStore } from '../stores/projectStore';

const DEBOUNCE_MS = 800;

/** Debounced save of the open project to IndexedDB. Returns a function to save immediately. */
export function useAutosave() {
  const revision = useFlowStore((s) => s.revision);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRevision = useRef(0);

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const flow = useFlowStore.getState();
    const project = flow.toProject();
    if (!project) return;
    const rev = flow.revision;
    flow.setSaveState('saving');
    try {
      await useProjectStore.getState().save(project);
      savedRevision.current = rev;
      // Only mark saved if nothing changed while the write was in flight.
      if (useFlowStore.getState().revision === rev) useFlowStore.getState().setSaveState('saved');
      else useFlowStore.getState().setSaveState('unsaved');
    } catch {
      useFlowStore.getState().setSaveState('error');
    }
  }, []);

  useEffect(() => {
    if (revision === 0 || revision === savedRevision.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), DEBOUNCE_MS);
  }, [revision, saveNow]);

  // Flush pending changes when leaving the editor or closing the tab.
  useEffect(() => {
    const flush = () => {
      if (useFlowStore.getState().revision !== savedRevision.current) void saveNow();
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      // Always write on leave so the last viewport is remembered too.
      void saveNow();
    };
  }, [saveNow]);

  return saveNow;
}

import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { MousePointerClick } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FlowCanvas from '../components/flow/FlowCanvas';
import { EditorTopbar, RunControls } from '../components/panels/EditorTopbar';
import { copyWithToast, cutWithToast, pasteWithToast } from '../features/editor/clipboard';
import NodePalette from '../components/panels/NodePalette';
import PropertiesPanel from '../components/panels/PropertiesPanel';
import ExportDialog from '../components/panels/ExportDialog';
import ShortcutsDialog from '../components/panels/ShortcutsDialog';
import ZoomControls from '../components/panels/ZoomControls';
import IssuesDialog from '../components/simulation/IssuesDialog';
import SimulationLog from '../components/simulation/SimulationLog';
import SimulationToolbar from '../components/simulation/SimulationToolbar';
import { useAutosave } from '../hooks/useAutosave';
import { useFlowStore } from '../stores/flowStore';
import { useProjectStore } from '../stores/projectStore';
import { useSimulationStore } from '../stores/simulationStore';
import { useUiStore } from '../stores/uiStore';
import { isFlowchartKind } from '../components/nodes/registry';
import { isTypingTarget } from '../utils/misc';

function useEditorShortcuts(saveNow: () => Promise<void>) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const flow = useFlowStore.getState();
      const sim = useSimulationStore.getState();
      const ui = useUiStore.getState();

      if (mod && key === 's') {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (mod && key === 'e') {
        e.preventDefault();
        ui.setExportOpen(true);
        return;
      }
      if (isTypingTarget(e.target)) return;
      // Canvas shortcuts must not act behind an open dialog.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      if (mod && key === 'enter' && !sim.active) {
        e.preventDefault();
        sim.start();
        return;
      }
      if (e.key === 'Escape') {
        if (ui.presentation) ui.setPresentation(false);
        else if (sim.active) sim.exit();
        else flow.clearSelection();
        return;
      }
      if (e.shiftKey && e.code === 'Digit1') {
        void fitView({ padding: 0.2, duration: 300, maxZoom: 1 });
        return;
      }
      // A single selected flowchart shape: Enter / F2 edits its text, typing replaces it.
      const only = !sim.active && flow.selectedNodeIds.length === 1 && !flow.selectedEdgeIds.length
        ? flow.nodes.find((n) => n.id === flow.selectedNodeIds[0])
        : undefined;
      if (only && isFlowchartKind(only.type) && !mod && !e.altKey) {
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          return ui.startEditing(only.id);
        }
        if (e.key.length === 1) {
          e.preventDefault();
          return ui.startEditing(only.id, e.key);
        }
      }

      if (!mod && key === 'p') return ui.setPresentation(!ui.presentation);
      if (e.key === '?') return ui.setShortcutsOpen(true);

      if (sim.active) {
        if (e.key === ' ') {
          e.preventDefault();
          if (sim.status === 'running') sim.pause();
          else sim.play();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          sim.next();
        } else if (key === 'r' && !mod) sim.restart();
        return;
      }

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) flow.redo();
        else flow.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        flow.redo();
      } else if (mod && key === 'a') {
        e.preventDefault();
        flow.selectAll();
      } else if (mod && key === 'c') {
        e.preventDefault();
        copyWithToast();
      } else if (mod && key === 'x') {
        e.preventDefault();
        cutWithToast();
      } else if (mod && key === 'v') {
        e.preventDefault();
        pasteWithToast();
      } else if (mod && key === 'd') {
        e.preventDefault();
        flow.duplicateSelection();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        flow.deleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow, fitView]);
}

function EmptyHint() {
  const count = useFlowStore((s) => s.nodes.length);
  const simActive = useSimulationStore((s) => s.active);
  if (count > 1 || simActive) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
      <div className="panel fade-in flex items-center gap-3 px-4 py-3 text-[13px] text-gray-600">
        <MousePointerClick size={18} className="text-[var(--color-brand)]" />
        <span>
          Drag components from the left onto the canvas, then pull from a node’s <b>bottom handle</b> to connect.
        </span>
      </div>
    </div>
  );
}

function Editor() {
  const saveNow = useAutosave();
  useEditorShortcuts(saveNow);
  const simActive = useSimulationStore((s) => s.active);
  const presentation = useUiStore((s) => s.presentation);

  // Leave fullscreen state in sync if the user exits it with the browser.
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && useUiStore.getState().presentation) useUiStore.setState({ presentation: false });
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <FlowCanvas />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-3">
        {!presentation ? <EditorTopbar /> : <span />}
        {simActive && <SimulationToolbar />}
        <RunControls />
      </div>

      {!simActive && !presentation && <NodePalette />}
      {!presentation && <PropertiesPanel />}
      <EmptyHint />

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3">
        {simActive && !presentation ? <SimulationLog /> : <span />}
        <ZoomControls />
      </div>

      <IssuesDialog />
      <ShortcutsDialog />
      <ExportDialog />
    </div>
  );
}

export default function EditorPage() {
  const { projectId } = useParams();
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    useSimulationStore.getState().exit();
    useProjectStore
      .getState()
      .get(projectId ?? '')
      .then((project) => {
        if (cancelled) return;
        if (!project) return setState('missing');
        useFlowStore.getState().load(project);
        setState('ready');
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
      useSimulationStore.getState().exit();
      useUiStore.getState().setPresentation(false);
    };
  }, [projectId]);

  if (state === 'loading') return <div className="grid-bg h-full" />;
  if (state === 'missing') {
    return (
      <div className="grid-bg flex h-full items-center justify-center p-4">
        <div className="panel max-w-sm p-6 text-center">
          <h1 className="text-[15px] font-semibold">Project not found</h1>
          <p className="mt-1 text-[13px] text-gray-500">It may have been deleted, or it was saved in a different browser.</p>
          <Link to="/" className="mt-4 inline-block rounded-lg bg-[var(--color-brand)] px-4 py-2 text-[13px] font-semibold text-white">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }
  return (
    <ReactFlowProvider key={projectId}>
      <Editor />
    </ReactFlowProvider>
  );
}

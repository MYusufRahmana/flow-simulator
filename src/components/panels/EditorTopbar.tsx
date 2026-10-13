import {
  ClipboardPaste,
  Copy,
  Download,
  Keyboard,
  Maximize,
  Play,
  Redo2,
  Square,
  SquareDashedMousePointer,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadProject } from '../../features/projects/io';
import { copyWithToast, pasteWithToast } from '../../features/editor/clipboard';
import { useImportProject } from '../../hooks/useImportProject';
import { useFlowStore } from '../../stores/flowStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUiStore } from '../../stores/uiStore';
import { Divider, IconButton, Modal } from '../common/ui';
import Logo from '../common/Logo';

function DeleteAllDialog({ onClose }: { onClose: () => void }) {
  const nodes = useFlowStore((s) => s.nodes.length);
  const edges = useFlowStore((s) => s.edges.length);
  return (
    <Modal title="Hapus semua komponen?" onClose={onClose}>
      <p className="text-[13px] leading-relaxed text-gray-600">
        {nodes} node dan {edges} koneksi akan dihapus dari kanvas. Kamu masih bisa mengembalikannya dengan <b>Undo</b> (Ctrl+Z).
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
          Batal
        </button>
        <button
          autoFocus
          onClick={() => {
            const count = useFlowStore.getState().deleteAll();
            useUiStore.getState().showToast(`${count} komponen dihapus. Ctrl+Z untuk membatalkan.`);
            onClose();
          }}
          className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700"
        >
          Hapus semua
        </button>
      </div>
    </Modal>
  );
}

const SAVE_LABEL = {
  saved: { text: 'Saved', dot: 'bg-emerald-500' },
  saving: { text: 'Saving…', dot: 'bg-amber-400' },
  unsaved: { text: 'Unsaved changes', dot: 'bg-gray-300' },
  error: { text: 'Save failed', dot: 'bg-red-500' },
} as const;

export function EditorTopbar() {
  const name = useFlowStore((s) => s.name);
  const setName = useFlowStore((s) => s.setName);
  const saveState = useFlowStore((s) => s.saveState);
  const canUndo = useFlowStore((s) => s.past.length > 0);
  const canRedo = useFlowStore((s) => s.future.length > 0);
  const simActive = useSimulationStore((s) => s.active);
  const save = SAVE_LABEL[saveState];
  const { inputRef, openPicker, importFiles } = useImportProject();
  const isEmpty = useFlowStore((s) => s.nodes.length === 0 && s.edges.length === 0);
  const hasSelection = useFlowStore((s) => s.selectedNodeIds.length > 0);
  const clipboardCount = useFlowStore((s) => s.clipboardCount);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="panel pointer-events-auto flex h-14 items-center gap-1 pr-2 pl-2">
      <Link to="/" aria-label="Back to projects" title="All projects" className="rounded-lg p-1 transition hover:bg-gray-100">
        <Logo size={30} />
      </Link>
      <div className="ml-1 flex min-w-0 flex-col">
        <input
          aria-label="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={simActive}
          className={`${simActive ? 'w-[150px]' : 'w-[200px]'} truncate rounded-md bg-transparent px-1.5 py-0.5 text-[15px] font-semibold text-gray-900 outline-none hover:bg-gray-100 focus:bg-gray-100 disabled:hover:bg-transparent`}
        />
        <span className="flex items-center gap-1.5 px-1.5 text-[11px] text-gray-500" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${save.dot}`} />
          {save.text}
        </span>
      </div>
      {!simActive && (
        <>
          <Divider />
          <IconButton label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => useFlowStore.getState().undo()}>
            <Undo2 size={18} />
          </IconButton>
          <IconButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => useFlowStore.getState().redo()}>
            <Redo2 size={18} />
          </IconButton>
          <Divider />
          <IconButton label="Pilih semua" shortcut="Ctrl+A" disabled={isEmpty} onClick={() => useFlowStore.getState().selectAll()}>
            <SquareDashedMousePointer size={18} />
          </IconButton>
          <IconButton
            label={hasSelection ? 'Copy yang dipilih' : 'Copy semua komponen'}
            shortcut="Ctrl+C"
            disabled={isEmpty}
            onClick={copyWithToast}
          >
            <Copy size={17} />
          </IconButton>
          <IconButton
            label={clipboardCount ? `Paste ${clipboardCount} komponen` : 'Paste (clipboard kosong)'}
            shortcut="Ctrl+V"
            disabled={!clipboardCount}
            onClick={pasteWithToast}
          >
            <ClipboardPaste size={18} />
          </IconButton>
          <IconButton label="Hapus semua komponen" disabled={isEmpty} className="hover:!text-red-600" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={17} />
          </IconButton>
          {confirmDelete && <DeleteAllDialog onClose={() => setConfirmDelete(false)} />}
        </>
      )}
      <Divider />
      {!simActive && (
        <IconButton label="Import project (opens as a new project)" onClick={openPicker}>
          <Upload size={18} />
        </IconButton>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => void importFiles(e.target.files)}
      />
      <IconButton
        label="Export project"
        onClick={() => {
          const p = useFlowStore.getState().toProject();
          if (p) downloadProject(p);
        }}
      >
        <Download size={18} />
      </IconButton>
      <IconButton label="Keyboard shortcuts" shortcut="?" onClick={() => useUiStore.getState().setShortcutsOpen(true)}>
        <Keyboard size={18} />
      </IconButton>
    </div>
  );
}

export function RunControls() {
  const simActive = useSimulationStore((s) => s.active);
  const presentation = useUiStore((s) => s.presentation);
  const setPresentation = useUiStore((s) => s.setPresentation);

  return (
    <div className="panel pointer-events-auto flex h-14 items-center gap-1.5 px-2">
      <IconButton label={presentation ? 'Exit presentation' : 'Presentation mode'} shortcut="P" pressed={presentation} onClick={() => setPresentation(!presentation)}>
        <Maximize size={18} />
      </IconButton>
      {simActive ? (
        <button
          type="button"
          onClick={() => useSimulationStore.getState().exit()}
          title="Back to design (Esc)"
          className="flex h-10 items-center gap-2 rounded-lg border border-black/10 px-3.5 text-[14px] font-semibold text-gray-800 transition hover:bg-gray-50"
        >
          <Square size={14} fill="currentColor" />
          Design
        </button>
      ) : (
        <button
          type="button"
          onClick={() => useSimulationStore.getState().start()}
          title="Run simulation (Ctrl+Enter)"
          className="flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-[14px] font-semibold text-white transition hover:bg-[var(--color-brand-hover)]"
        >
          <Play size={15} fill="currentColor" />
          Run simulation
        </button>
      )}
    </div>
  );
}

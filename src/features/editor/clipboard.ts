import { useFlowStore } from '../../stores/flowStore';
import { useUiStore } from '../../stores/uiStore';

/** Copy the selection (or everything) and say what happened. Shared by the button and Ctrl+C. */
export function copyWithToast() {
  const flow = useFlowStore.getState();
  const hadSelection = flow.nodes.some((n) => n.selected);
  const count = flow.copySelection();
  const { showToast } = useUiStore.getState();
  if (!count) showToast('Kanvas kosong, tidak ada yang bisa dicopy', 'error');
  else showToast(`${count} komponen ${hadSelection ? 'terpilih' : '(semua)'} dicopy. Tekan Ctrl+V untuk paste.`);
}

export function pasteWithToast() {
  const count = useFlowStore.getState().paste();
  const { showToast } = useUiStore.getState();
  if (!count) showToast('Clipboard kosong. Copy komponen dulu.', 'error');
  else showToast(`${count} komponen di-paste`);
}

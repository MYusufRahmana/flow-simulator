import { create } from 'zustand';
import { prefs } from '../db/indexedDb';
import type { NodeCategory } from '../types/flow';

export type Toast = { id: number; text: string; tone: 'ok' | 'error' };

type UiState = {
  toast: Toast | null;
  showToast: (text: string, tone?: Toast['tone']) => void;
  hideToast: () => void;
  paletteCollapsed: boolean;
  paletteCategory: NodeCategory;
  logOpen: boolean;
  minimap: boolean;
  presentation: boolean;
  shortcutsOpen: boolean;
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  /** Node whose text is being edited right on the canvas. */
  editing: { nodeId: string; seed?: string } | null;
  /** Start inline text editing; `seed` replaces the text (the key that was typed). */
  startEditing: (nodeId: string, seed?: string) => void;
  stopEditing: () => void;
  togglePalette: () => void;
  setPaletteCategory: (category: NodeCategory) => void;
  setLogOpen: (open: boolean) => void;
  toggleMinimap: () => void;
  setPresentation: (on: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
};

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  toast: null,
  showToast: (text, tone = 'ok') => set({ toast: { id: ++toastSeq, text, tone } }),
  hideToast: () => set({ toast: null }),
  paletteCollapsed: prefs.get('paletteCollapsed', false),
  paletteCategory: prefs.get<NodeCategory>('paletteCategory', 'simulation'),
  logOpen: prefs.get('logOpen', true),
  minimap: prefs.get('minimap', false),
  presentation: false,
  shortcutsOpen: false,
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  editing: null,
  startEditing: (nodeId, seed) => set({ editing: { nodeId, seed } }),
  stopEditing: () => set({ editing: null }),

  togglePalette: () => {
    const v = !get().paletteCollapsed;
    prefs.set('paletteCollapsed', v);
    set({ paletteCollapsed: v });
  },
  setPaletteCategory: (paletteCategory) => {
    prefs.set('paletteCategory', paletteCategory);
    set({ paletteCategory });
  },
  setLogOpen: (logOpen) => {
    prefs.set('logOpen', logOpen);
    set({ logOpen });
  },
  toggleMinimap: () => {
    const v = !get().minimap;
    prefs.set('minimap', v);
    set({ minimap: v });
  },
  setPresentation: (presentation) => {
    set({ presentation });
    try {
      if (presentation && !document.fullscreenElement) void document.documentElement.requestFullscreen?.();
      if (!presentation && document.fullscreenElement) void document.exitFullscreen?.();
    } catch {
      /* fullscreen is a nice-to-have */
    }
  },
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
}));

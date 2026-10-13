import { create } from 'zustand';
import { prefs } from '../db/indexedDb';

export type Toast = { id: number; text: string; tone: 'ok' | 'error' };

type UiState = {
  toast: Toast | null;
  showToast: (text: string, tone?: Toast['tone']) => void;
  hideToast: () => void;
  paletteCollapsed: boolean;
  logOpen: boolean;
  minimap: boolean;
  presentation: boolean;
  shortcutsOpen: boolean;
  togglePalette: () => void;
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
  logOpen: prefs.get('logOpen', true),
  minimap: prefs.get('minimap', false),
  presentation: false,
  shortcutsOpen: false,

  togglePalette: () => {
    const v = !get().paletteCollapsed;
    prefs.set('paletteCollapsed', v);
    set({ paletteCollapsed: v });
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

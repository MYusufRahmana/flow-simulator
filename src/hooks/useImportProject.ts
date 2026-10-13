import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportError } from '../features/projects/io';
import { useProjectStore } from '../stores/projectStore';
import { useUiStore } from '../stores/uiStore';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Import .flow.json files as new projects and open the (last) imported one.
 * Returns a ref for a hidden <input type="file">, a picker opener, and a handler for dropped files.
 */
export function useImportProject() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const importFiles = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      const list = Array.from(files ?? []);
      if (!list.length) return;
      const { showToast } = useUiStore.getState();
      let lastId: string | null = null;
      const failed: string[] = [];
      for (const file of list) {
        try {
          if (file.size > MAX_BYTES) throw new ImportError('File lebih dari 5 MB.');
          const project = await useProjectStore.getState().importFile(await file.text());
          lastId = project.id;
        } catch (e) {
          failed.push(`${file.name}: ${e instanceof ImportError ? e.message : 'gagal dibaca.'}`);
        }
      }
      if (inputRef.current) inputRef.current.value = '';
      if (failed.length) showToast(`Project file tidak valid. ${failed.join(' · ')}`, 'error');
      else showToast(list.length > 1 ? `${list.length} project berhasil di-import` : 'Project berhasil di-import');
      if (lastId) navigate(`/editor/${lastId}`);
    },
    [navigate],
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return { inputRef, openPicker, importFiles };
}

/** True when a drag event carries files (not text or our palette nodes). */
export function isFileDrag(e: { dataTransfer: DataTransfer | null }) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
}

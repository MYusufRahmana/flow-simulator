import { useReactFlow } from '@xyflow/react';
import { ClipboardCopy, Download, FileCode2, FileImage, FileJson, FileText, Image, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { prefs } from '../../db/indexedDb';
import {
  copyDiagramToClipboard,
  exportDiagram,
  type ExportBackground,
  type ExportFormat,
  type ExportOptions,
  type PdfPage,
} from '../../features/export/exportDiagram';
import { downloadProject } from '../../features/projects/io';
import { useFlowStore } from '../../stores/flowStore';
import { useUiStore } from '../../stores/uiStore';
import type { FlowEdge, FlowNode } from '../../types/flow';
import { Modal, Segmented, Toggle } from '../common/ui';

type Choice = ExportFormat | 'json';

const FORMATS: { value: Choice; label: string; hint: string; icon: ReactNode }[] = [
  { value: 'png', label: 'PNG', hint: 'Slide & chat', icon: <Image size={18} /> },
  { value: 'pdf', label: 'PDF', hint: 'Dokumen & cetak', icon: <FileText size={18} /> },
  { value: 'svg', label: 'SVG', hint: 'Vektor, tajam', icon: <FileCode2 size={18} /> },
  { value: 'jpg', label: 'JPG', hint: 'Ukuran kecil', icon: <FileImage size={18} /> },
  { value: 'json', label: 'Project', hint: '.json, bisa di-import', icon: <FileJson size={18} /> },
];

type DialogOptions = Omit<ExportOptions, 'format'> & { format: Choice };

const DEFAULTS: DialogOptions = {
  format: 'png',
  selectionOnly: false,
  background: 'white',
  scale: 2,
  pdfPage: 'fit',
  pdfTitle: true,
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-medium text-gray-500">{label}</span>
      {children}
    </div>
  );
}

export default function ExportDialog() {
  const open = useUiStore((s) => s.exportOpen);
  if (!open) return null;
  return <ExportDialogBody />;
}

function ExportDialogBody() {
  const close = () => useUiStore.getState().setExportOpen(false);
  const { getNodesBounds } = useReactFlow<FlowNode, FlowEdge>();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const name = useFlowStore((s) => s.name);
  const selectedCount = nodes.filter((n) => n.selected).length;
  const [opts, setOpts] = useState(() => ({ ...DEFAULTS, ...prefs.get<Partial<DialogOptions>>('exportOptions', {}) }));
  const [busy, setBusy] = useState<'download' | 'copy' | null>(null);

  const set = (patch: Partial<DialogOptions>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    prefs.set('exportOptions', next);
  };

  const selectionOnly = opts.selectionOnly && selectedCount > 0;
  const picked = selectionOnly ? nodes.filter((n) => n.selected) : nodes;
  const ids = new Set(picked.map((n) => n.id));
  const scene = {
    nodes: picked,
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    bounds: getNodesBounds(picked),
  };
  const image = opts.format !== 'json';
  // JPG and PDF have no transparency.
  const background: ExportBackground =
    opts.background === 'transparent' && (opts.format === 'jpg' || opts.format === 'pdf') ? 'white' : opts.background;
  const pxW = Math.round((scene.bounds.width + 80) * (opts.format === 'svg' ? 1 : opts.scale));
  const pxH = Math.round((scene.bounds.height + 80) * (opts.format === 'svg' ? 1 : opts.scale));

  const toast = useUiStore.getState().showToast;

  const onDownload = async () => {
    if (opts.format === 'json') {
      const p = useFlowStore.getState().toProject();
      if (p) downloadProject(p);
      return close();
    }
    if (!picked.length) return toast('Kanvas kosong, tidak ada yang bisa di-export', 'error');
    setBusy('download');
    try {
      await exportDiagram(scene, { ...opts, format: opts.format, selectionOnly, background }, name);
      toast(`Export ${opts.format.toUpperCase()} selesai`);
      close();
    } catch (e) {
      console.error(e);
      toast('Export gagal. Coba resolusi lebih kecil.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async () => {
    if (!picked.length) return toast('Kanvas kosong, tidak ada yang bisa dicopy', 'error');
    setBusy('copy');
    try {
      await copyDiagramToClipboard(scene, { background, scale: opts.scale });
      toast('Gambar dicopy. Paste (Ctrl+V) di PowerPoint, Word, atau chat.');
      close();
    } catch (e) {
      console.error(e);
      toast('Browser menolak akses clipboard. Pakai Download PNG.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Export" onClose={close}>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Format">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={opts.format === f.value}
            onClick={() => set({ format: f.value })}
            className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition ${
              opts.format === f.value
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]'
                : 'border-black/10 text-gray-600 hover:border-black/20 hover:bg-gray-50'
            }`}
          >
            {f.icon}
            <span className="text-[12px] font-semibold">{f.label}</span>
            <span className="text-[10px] leading-tight text-gray-400">{f.hint}</span>
          </button>
        ))}
      </div>

      {image && (
        <div className="mt-4 space-y-2.5">
          <Row label="Area">
            <Segmented
              label="Area"
              value={selectionOnly ? 'selection' : 'all'}
              onChange={(v) => set({ selectionOnly: v === 'selection' })}
              options={[
                { value: 'all', label: 'Semua' },
                ...(selectedCount ? [{ value: 'selection' as const, label: `Dipilih (${selectedCount})` }] : []),
              ]}
            />
          </Row>
          <Row label="Background">
            <Segmented
              label="Background"
              value={background}
              onChange={(v) => set({ background: v })}
              options={[
                { value: 'white', label: 'Putih' },
                { value: 'canvas', label: 'Abu' },
                ...(opts.format === 'png' || opts.format === 'svg' ? [{ value: 'transparent' as const, label: 'Transparan' }] : []),
              ]}
            />
          </Row>
          {opts.format !== 'svg' && (
            <Row label="Resolusi">
              <Segmented
                label="Resolution"
                value={opts.scale}
                onChange={(scale) => set({ scale })}
                options={[
                  { value: 1, label: '1x', title: 'Standar' },
                  { value: 2, label: '2x', title: 'Tajam (disarankan)' },
                  { value: 3, label: '3x', title: 'Cetak / layar besar' },
                ]}
              />
            </Row>
          )}
          {opts.format === 'pdf' && (
            <>
              <Row label="Halaman">
                <Segmented<PdfPage>
                  label="Page size"
                  value={opts.pdfPage}
                  onChange={(pdfPage) => set({ pdfPage })}
                  options={[
                    { value: 'fit', label: 'Pas diagram' },
                    { value: 'a4', label: 'A4' },
                    { value: 'a3', label: 'A3' },
                  ]}
                />
              </Row>
              <Toggle label="Tampilkan judul & tanggal" checked={opts.pdfTitle} onChange={(pdfTitle) => set({ pdfTitle })} />
            </>
          )}
          <p className="text-[11px] text-gray-400">
            {picked.length} komponen ·{' '}
            {opts.format === 'pdf'
              ? opts.pdfPage === 'fit'
                ? 'halaman seukuran diagram'
                : `${opts.pdfPage.toUpperCase()}, orientasi otomatis`
              : `${pxW} × ${pxH} px`}
          </p>
        </div>
      )}
      {!image && (
        <p className="mt-4 text-[12px] leading-relaxed text-gray-500">
          File project lengkap (.flow.json). Bisa di-import lagi lewat tombol Import untuk melanjutkan edit.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        {image && opts.format !== 'pdf' && typeof ClipboardItem !== 'undefined' ? (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void onCopy()}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Copy gambar PNG ke clipboard"
          >
            {busy === 'copy' ? <Loader2 size={15} className="spin" /> : <ClipboardCopy size={15} />}
            Copy gambar
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button onClick={close} className="rounded-lg border border-black/10 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
            Batal
          </button>
          <button
            autoFocus
            disabled={!!busy}
            onClick={() => void onDownload()}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
          >
            {busy === 'download' ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            Download {opts.format === 'json' ? 'project' : opts.format.toUpperCase()}
          </button>
        </div>
      </div>
    </Modal>
  );
}

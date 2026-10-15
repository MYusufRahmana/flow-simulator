/**
 * Export the canvas as an image or PDF. Renders only the React Flow viewport (nodes, lines, labels),
 * framed tightly around the chosen nodes, so the result does not depend on the current zoom or scroll.
 */
import type { Rect } from '@xyflow/react';
import { toBlob, toJpeg, toPng, toSvg } from 'html-to-image';
import { useFlowStore } from '../../stores/flowStore';
import type { FlowEdge, FlowNode } from '../../types/flow';

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';
export type ExportBackground = 'white' | 'canvas' | 'transparent';
export type PdfPage = 'fit' | 'a4' | 'a3';

export type ExportOptions = {
  format: ExportFormat;
  /** Only the selected nodes (and the lines between them) instead of everything. */
  selectionOnly: boolean;
  background: ExportBackground;
  /** Pixel density: 2 = sharp on screens and projectors, 3 = print. */
  scale: 1 | 2 | 3;
  pdfPage: PdfPage;
  /** PDF only: project name and date above the diagram. */
  pdfTitle: boolean;
};

const PADDING = 40;
/** Browsers refuse canvases much larger than this on either side. */
const MAX_SIDE = 16000;
const BACKGROUND: Record<ExportBackground, string | undefined> = { white: '#ffffff', canvas: '#f2f2f2', transparent: undefined };

export function fileSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'flow';
}

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

type Scene = { nodes: FlowNode[]; edges: FlowEdge[]; bounds: Rect };

/** html-to-image options that frame `bounds` and keep only the picked nodes and lines. */
function renderOptions(scene: Scene, opts: Pick<ExportOptions, 'background' | 'scale'>, forceOpaque = false) {
  const width = Math.ceil(scene.bounds.width + PADDING * 2);
  const height = Math.ceil(scene.bounds.height + PADDING * 2);
  const pixelRatio = Math.max(0.5, Math.min(opts.scale, MAX_SIDE / Math.max(width, height)));
  const nodeIds = new Set(scene.nodes.map((n) => n.id));
  const edgeIds = new Set(scene.edges.map((e) => e.id));

  const filter = (el: HTMLElement) => {
    if (!(el instanceof Element)) return true;
    const testId = el.getAttribute('data-testid') ?? '';
    if (testId.startsWith('rf__node-')) return nodeIds.has(testId.slice('rf__node-'.length));
    if (testId.startsWith('rf__edge-')) return edgeIds.has(testId.slice('rf__edge-'.length));
    const edgeLabel = el.getAttribute('data-edge-id');
    if (edgeLabel) return edgeIds.has(edgeLabel);
    return true;
  };

  return {
    width,
    height,
    pixelRatio,
    filter,
    backgroundColor: BACKGROUND[opts.background] ?? (forceOpaque ? '#ffffff' : undefined),
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - scene.bounds.x}px, ${PADDING - scene.bounds.y}px) scale(1)`,
    },
  };
}

/** Run `capture` with the canvas in its static, print-friendly state. */
async function withExportStyles<T>(capture: (viewport: HTMLElement) => Promise<T>): Promise<T> {
  const root = document.querySelector<HTMLElement>('.react-flow');
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!root || !viewport) throw new Error('Canvas not found');
  // Selection outlines are editing chrome, not part of the diagram.
  useFlowStore.getState().clearSelection();
  root.classList.add('exporting');
  try {
    // Let React re-render without the selection, and the class apply, before html-to-image reads styles.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await capture(viewport);
  } finally {
    root.classList.remove('exporting');
  }
}

export async function exportDiagram(scene: Scene, opts: ExportOptions, projectName: string) {
  const name = fileSlug(projectName);

  if (opts.format === 'svg') {
    const url = await withExportStyles((vp) => toSvg(vp, renderOptions(scene, opts)));
    return download(url, `${name}.svg`);
  }
  if (opts.format === 'jpg') {
    const url = await withExportStyles((vp) => toJpeg(vp, { ...renderOptions(scene, opts, true), quality: 0.95 }));
    return download(url, `${name}.jpg`);
  }

  const png = await withExportStyles((vp) => toPng(vp, renderOptions(scene, opts, opts.format === 'pdf')));
  if (opts.format === 'png') return download(png, `${name}.png`);

  await savePdf(png, scene, opts, projectName, name);
}

async function savePdf(png: string, scene: Scene, opts: ExportOptions, projectName: string, name: string) {
  const { jsPDF } = await import('jspdf');
  // Diagram size in PDF points (1 CSS px = 0.75 pt).
  const imgW = (scene.bounds.width + PADDING * 2) * 0.75;
  const imgH = (scene.bounds.height + PADDING * 2) * 0.75;
  const margin = 28;
  const titleH = opts.pdfTitle ? 44 : 0;
  // Orientation from the whole page content (title included), or jsPDF swaps a custom size the wrong way round.
  const fitW = imgW + margin * 2;
  const fitH = imgH + margin * 2 + titleH;
  const doc =
    opts.pdfPage === 'fit'
      ? new jsPDF({ unit: 'pt', format: [fitW, fitH], orientation: fitW > fitH ? 'landscape' : 'portrait' })
      : new jsPDF({ unit: 'pt', format: opts.pdfPage, orientation: imgW > imgH ? 'landscape' : 'portrait' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (opts.pdfTitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(28, 29, 34);
    doc.text(projectName || 'Flow', margin, margin + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 128);
    const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(date, margin, margin + 30);
  }

  // Fit inside the page (never upscale past the diagram's own size), centred below the title.
  const boxW = pageW - margin * 2;
  const boxH = pageH - margin * 2 - titleH;
  const k = Math.min(1, boxW / imgW, boxH / imgH);
  const w = imgW * k;
  const h = imgH * k;
  doc.addImage(png, 'PNG', margin + (boxW - w) / 2, margin + titleH + (boxH - h) / 2, w, h, undefined, 'FAST');
  doc.save(`${name}.pdf`);
}

/** Put a PNG of the diagram on the clipboard, ready to paste into PowerPoint, Word, WhatsApp, etc. */
export async function copyDiagramToClipboard(scene: Scene, opts: Pick<ExportOptions, 'background' | 'scale'>) {
  const blob = await withExportStyles((vp) => toBlob(vp, renderOptions(scene, opts)));
  if (!blob) throw new Error('Could not render the image');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

import { Copy, FileJson, FileUp, Plus, Trash2, Upload, Workflow } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/common/Logo';
import { IconButton } from '../components/common/ui';
import { NODE_META } from '../components/nodes/registry';
import { isFileDrag, useImportProject } from '../hooks/useImportProject';
import { TEMPLATES, type Template } from '../features/projects/templates';
import { useProjectStore } from '../stores/projectStore';
import { relativeTime } from '../utils/misc';

function TemplatePreview({ template }: { template: Template }) {
  return (
    <div className="flex h-16 items-center justify-center gap-0 overflow-hidden rounded-lg border border-black/5 bg-[var(--color-canvas)] [background-image:linear-gradient(var(--color-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-grid)_1px,transparent_1px)] [background-size:12px_12px]">
      {template.kinds.slice(0, 6).map((kind, i) => {
        const meta = NODE_META[kind];
        const Icon = meta.icon;
        return (
          <div key={kind + i} className="flex items-center">
            {i > 0 && <span className="h-px w-3 bg-gray-400" />}
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md border border-black/8 bg-white shadow-sm"
              style={{ color: meta.color }}
            >
              <Icon size={13} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { projects, loaded, error, refresh, create, duplicate, remove } = useProjectStore();
  const { inputRef, openPicker, importFiles } = useImportProject();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = (id: string) => navigate(`/editor/${id}`);
  const newProject = async (templateId?: string) => open((await create(templateId)).id);

  return (
    <div
      className="grid-bg relative min-h-full overflow-y-auto"
      onDragEnter={(e) => {
        if (!isFileDrag(e)) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        if (!isFileDrag(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void importFiles(e.dataTransfer.files);
      }}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between p-3">
        <div className="panel flex h-14 items-center gap-3 px-4">
          <Logo variant="full" size={26} />
          <span className="h-6 w-px bg-black/8" />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold text-gray-800">Simulator</div>
            <div className="text-[11px] text-gray-500">Local-first · no account needed</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-10 pb-20 sm:pt-16">
        <section className="panel p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-gray-900 sm:text-[32px]">
                Design and simulate application flows.
              </h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-gray-500">
                Draw the flow, press <b className="font-semibold text-gray-700">Run</b>, and watch the data travel through every page, API,
                service and table — step by step.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => void newProject()}
                className="flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-[14px] font-semibold text-white transition hover:bg-[var(--color-brand-hover)]"
              >
                <Plus size={17} /> New diagram
              </button>
              <button
                type="button"
                onClick={openPicker}
                title="Import a .flow.json file (or drop it anywhere on this page)"
                className="flex h-10 items-center gap-2 rounded-lg border border-black/10 bg-white px-4 text-[14px] font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                <Upload size={16} /> Import
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                multiple
                className="hidden"
                onChange={(e) => void importFiles(e.target.files)}
              />
            </div>
          </div>
        </section>

        <p className="mt-3 px-1 text-[12px] text-gray-500">
          Tip: seret file <code className="font-mono">.flow.json</code> ke halaman ini untuk import.
        </p>

        <section className="mt-6">
          <h2 className="mb-3 px-1 text-[12px] font-semibold tracking-wider text-gray-500 uppercase">Start from an example</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void newProject(t.id)}
                className="panel group p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-brand)]/40"
              >
                <TemplatePreview template={t} />
                <div className="mt-3 text-[14px] font-semibold text-gray-900 group-hover:text-[var(--color-brand)]">{t.name}</div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-gray-500">{t.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 px-1 text-[12px] font-semibold tracking-wider text-gray-500 uppercase">Recent projects</h2>
          <div className="panel overflow-hidden">
            {error && <p className="p-4 text-[13px] text-red-600">{error}</p>}
            {loaded && !projects.length && !error && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <Workflow size={28} className="text-gray-300" />
                <p className="text-[14px] font-medium text-gray-700">No projects yet</p>
                <p className="text-[13px] text-gray-500">Create a new diagram or start from an example above.</p>
              </div>
            )}
            <ul className="divide-y divide-black/5">
              {projects.map((p) => (
                <li key={p.id} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50/80">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
                    <FileJson size={17} />
                  </span>
                  <button type="button" onClick={() => open(p.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[14px] font-semibold text-gray-900">{p.name}</div>
                    <div className="text-[12px] text-gray-500">
                      {p.nodes.length} nodes · {p.edges.length} connections · updated {relativeTime(p.updatedAt)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => open(p.id)}
                    className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-800 hover:border-black/20"
                  >
                    Open
                  </button>
                  <IconButton label="Duplicate" onClick={() => void duplicate(p.id)}>
                    <Copy size={16} />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    className="hover:!text-red-600"
                    onClick={() => {
                      if (confirm(`Delete “${p.name}”? This cannot be undone.`)) void remove(p.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-brand)] bg-[var(--color-brand)]/5">
          <div className="panel flex items-center gap-3 px-5 py-4 text-[15px] font-semibold text-gray-800">
            <FileUp size={22} className="text-[var(--color-brand)]" />
            Lepaskan file .flow.json untuk import
          </div>
        </div>
      )}
    </div>
  );
}

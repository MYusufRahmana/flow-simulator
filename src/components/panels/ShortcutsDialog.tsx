import { Fragment } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { Modal } from '../common/ui';

/** Keys use `+` for a combination and `/` for alternatives, e.g. `Ctrl+Shift+Z`, `Enter/F2`. */
type Group = { title: string; items: [keys: string, description: string][] };

const COLUMNS: Group[][] = [
  [
    {
      title: 'Design',
      items: [
        ['Ctrl+Z', 'Undo'],
        ['Ctrl+Shift+Z', 'Redo'],
        ['Ctrl+S', 'Save now'],
        ['Ctrl+E', 'Export (PNG, PDF, SVG…)'],
      ],
    },
    {
      title: 'Selection',
      items: [
        ['Ctrl+A', 'Select all'],
        ['Shift+Drag', 'Box select'],
        ['Ctrl+C', 'Copy selection (or everything)'],
        ['Ctrl+X', 'Cut selection'],
        ['Ctrl+V', 'Paste'],
        ['Ctrl+D', 'Duplicate selection'],
        ['Delete', 'Delete selection'],
        ['Right-click', 'Context menu'],
      ],
    },
    {
      title: 'View',
      items: [
        ['Shift+1', 'Fit view'],
        ['P', 'Presentation mode'],
        ['?', 'This help'],
      ],
    },
  ],
  [
    {
      title: 'Flowchart text',
      items: [
        ['Double-click', 'Edit text of a shape'],
        ['Enter/F2', 'Edit the selected shape'],
        ['Type', 'Replace the selected shape’s text'],
        ['Shift+Enter', 'New line while editing'],
        ['Enter', 'Save text'],
        ['Esc', 'Cancel editing'],
      ],
    },
    {
      title: 'Simulation',
      items: [
        ['Ctrl+Enter', 'Run simulation'],
        ['Space', 'Play / pause'],
        ['→', 'Next step'],
        ['R', 'Restart'],
        ['Esc', 'Back to design'],
      ],
    },
  ],
];

function Keys({ keys }: { keys: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.split('/').map((combo, i) => (
        <Fragment key={combo}>
          {i > 0 && <span className="px-0.5 text-[11px] text-gray-400">or</span>}
          {combo.split('+').map((k, j) => (
            <Fragment key={k}>
              {j > 0 && <span className="text-[11px] text-gray-300">+</span>}
              <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md border border-black/10 border-b-black/20 bg-white px-1.5 font-sans text-[11px] font-medium text-gray-600 shadow-[0_1px_0_rgb(0_0_0/0.04)]">
                {k}
              </kbd>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

export default function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  if (!open) return null;
  return (
    <Modal title="Keyboard shortcuts" wide onClose={() => setOpen(false)}>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {COLUMNS.map((groups, ci) => (
          <div key={ci} className="space-y-5">
            {groups.map((g) => (
              <section key={g.title}>
                <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{g.title}</h3>
                <dl className="divide-y divide-black/5">
                  {g.items.map(([keys, desc]) => (
                    <div key={desc} className="flex min-h-[34px] items-center justify-between gap-3 py-1 text-[13px]">
                      <dt className="min-w-0 text-gray-700">{desc}</dt>
                      <dd>
                        <Keys keys={keys} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

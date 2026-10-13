import { useUiStore } from '../../stores/uiStore';
import { Modal } from '../common/ui';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Design',
    items: [
      ['Ctrl Z', 'Undo'],
      ['Ctrl Shift Z', 'Redo'],
      ['Ctrl S', 'Save now'],
      ['Ctrl A', 'Select all'],
      ['Ctrl C', 'Copy selection (or everything)'],
      ['Ctrl X', 'Cut selection'],
      ['Ctrl V', 'Paste'],
      ['Ctrl D', 'Duplicate selection'],
      ['Delete', 'Delete selection'],
      ['Shift drag', 'Box select'],
    ],
  },
  {
    title: 'Simulation',
    items: [
      ['Ctrl Enter', 'Run simulation'],
      ['Space', 'Play / pause'],
      ['→', 'Next step'],
      ['R', 'Restart'],
      ['Esc', 'Back to design'],
    ],
  },
  {
    title: 'View',
    items: [
      ['Shift 1', 'Fit view'],
      ['P', 'Presentation mode'],
      ['?', 'This help'],
    ],
  },
];

export default function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  if (!open) return null;
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setOpen(false)}>
      <div className="space-y-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{g.title}</div>
            <dl className="space-y-1">
              {g.items.map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between text-[13px]">
                  <dt className="text-gray-700">{desc}</dt>
                  <dd className="flex gap-1">
                    {key.split(' ').map((k) => (
                      <kbd key={k} className="rounded border border-black/10 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-600">
                        {k}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Modal>
  );
}

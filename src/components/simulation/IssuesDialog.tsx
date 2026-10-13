import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useSimulationStore } from '../../stores/simulationStore';
import { Modal } from '../common/ui';
import { useFocusNode } from '../../hooks/useFocusNode';

export default function IssuesDialog() {
  const issues = useSimulationStore((s) => s.issues);
  const dismiss = useSimulationStore((s) => s.dismissIssues);
  const focusNode = useFocusNode();
  if (!issues) return null;
  const errors = issues.filter((i) => i.level === 'error').length;

  return (
    <Modal title="Simulation cannot start" onClose={dismiss}>
      <p className="mb-3 text-[13px] text-gray-500">
        {errors} {errors === 1 ? 'issue' : 'issues'} found. Fix them in the diagram, then run again.
      </p>
      <ul className="scroll-thin max-h-[320px] space-y-1.5 overflow-y-auto">
        {issues.map((issue, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={!issue.nodeId}
              onClick={() => {
                if (!issue.nodeId) return;
                dismiss();
                focusNode(issue.nodeId);
              }}
              className="flex w-full items-start gap-2 rounded-lg border border-black/6 px-3 py-2 text-left text-[13px] hover:bg-gray-50 disabled:hover:bg-transparent"
            >
              {issue.level === 'error' ? (
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
              ) : (
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
              )}
              <span className="text-gray-700">{issue.message}</span>
              {issue.nodeId && <span className="ml-auto shrink-0 text-[11px] font-medium text-[var(--color-brand)]">Show</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <button onClick={dismiss} className="rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-gray-800" autoFocus>
          Got it
        </button>
      </div>
    </Modal>
  );
}

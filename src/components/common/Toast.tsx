import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useUiStore } from '../../stores/uiStore';

export default function Toast() {
  const toast = useUiStore((s) => s.toast);
  const hide = useUiStore((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, toast.tone === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="panel fade-in fixed bottom-20 left-1/2 z-[60] flex max-w-[min(560px,calc(100vw-24px))] -translate-x-1/2 items-start gap-2 px-4 py-2.5 text-[13px] font-medium text-gray-800"
    >
      {toast.tone === 'error' ? (
        <XCircle size={16} className="mt-px shrink-0 text-red-500" />
      ) : (
        <CheckCircle2 size={16} className="mt-px shrink-0 text-emerald-500" />
      )}
      <span className={toast.tone === 'error' ? 'text-red-700' : ''}>{toast.text}</span>
    </div>
  );
}

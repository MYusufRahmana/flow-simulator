import { useReactFlow, useViewport } from '@xyflow/react';
import { Map, Minus, Plus, Scan } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { Divider, IconButton } from '../common/ui';

export default function ZoomControls() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const minimap = useUiStore((s) => s.minimap);
  const toggleMinimap = useUiStore((s) => s.toggleMinimap);

  return (
    <div className="panel pointer-events-auto flex h-12 items-center gap-0.5 px-1.5">
      <IconButton label="Zoom out" shortcut="-" onClick={() => zoomOut({ duration: 150 })}>
        <Minus size={18} />
      </IconButton>
      <button
        type="button"
        title="Reset to 100%"
        onClick={() => zoomTo(1, { duration: 200 })}
        className="w-[52px] rounded-md py-1 text-center text-[13px] font-medium text-gray-700 tabular-nums hover:bg-gray-100"
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton label="Zoom in" shortcut="+" onClick={() => zoomIn({ duration: 150 })}>
        <Plus size={18} />
      </IconButton>
      <Divider />
      <IconButton label="Fit view" shortcut="Shift+1" onClick={() => fitView({ padding: 0.2, duration: 300, maxZoom: 1 })}>
        <Scan size={17} />
      </IconButton>
      <IconButton label="Minimap" pressed={minimap} onClick={toggleMinimap}>
        <Map size={17} />
      </IconButton>
    </div>
  );
}

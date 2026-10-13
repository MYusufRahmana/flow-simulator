import { Crosshair, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { SPEEDS, useSimulationStore, type SimStatus } from '../../stores/simulationStore';
import { formatClock } from '../../utils/misc';
import { Divider, IconButton, Segmented } from '../common/ui';

const STATUS: Record<SimStatus, { label: string; cls: string }> = {
  idle: { label: 'Ready', cls: 'bg-gray-100 text-gray-600' },
  running: { label: 'Running', cls: 'bg-blue-50 text-blue-700' },
  paused: { label: 'Paused', cls: 'bg-amber-50 text-amber-700' },
  awaiting: { label: 'Your decision', cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
  stopped: { label: 'Stopped', cls: 'bg-red-50 text-red-700' },
};

export default function SimulationToolbar() {
  const status = useSimulationStore((s) => s.status);
  const mode = useSimulationStore((s) => s.mode);
  const speed = useSimulationStore((s) => s.speed);
  const follow = useSimulationStore((s) => s.follow);
  const clock = useSimulationStore((s) => s.clock);
  const steps = useSimulationStore((s) => s.steps);
  const hadFailure = useSimulationStore((s) => s.hadFailure);
  const sim = useSimulationStore.getState();
  const running = status === 'running';
  const s =
    status === 'completed' && hadFailure ? { label: 'Ended with error', cls: 'bg-amber-50 text-amber-700' } : STATUS[status];

  return (
    <div className="panel pointer-events-auto flex h-14 items-center gap-1 px-2" role="toolbar" aria-label="Simulation controls">
      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${s.cls}`} aria-live="polite">
        <span className={`h-1.5 w-1.5 rounded-full bg-current ${running ? 'animate-pulse' : ''}`} />
        {s.label}
      </span>
      <span className="w-[92px] text-center font-mono text-[12px] text-gray-500 tabular-nums" title={`${steps} steps`}>
        {formatClock(clock)} · {steps}
      </span>
      <Divider />
      {running ? (
        <IconButton label="Pause" shortcut="Space" onClick={sim.pause}>
          <Pause size={18} fill="currentColor" />
        </IconButton>
      ) : (
        <IconButton label="Play" shortcut="Space" onClick={sim.play} disabled={status === 'awaiting'} className="!text-[var(--color-brand)]">
          <Play size={18} fill="currentColor" />
        </IconButton>
      )}
      <IconButton label="Next step" shortcut="→" onClick={sim.next} disabled={status === 'awaiting'}>
        <SkipForward size={18} />
      </IconButton>
      <IconButton label="Restart" shortcut="R" onClick={sim.restart}>
        <RotateCcw size={17} />
      </IconButton>
      <Divider />
      <Segmented
        label="Simulation mode"
        value={mode}
        onChange={sim.setMode}
        options={[
          { value: 'auto', label: 'Auto', title: 'Run continuously' },
          { value: 'step', label: 'Step', title: 'Pause after every step' },
        ]}
      />
      <span className="w-1" />
      <Segmented
        label="Speed"
        value={speed}
        onChange={sim.setSpeed}
        options={SPEEDS.map((v) => ({ value: v, label: `${v}x` }))}
      />
      <Divider />
      <IconButton label="Follow token" pressed={follow} onClick={sim.toggleFollow}>
        <Crosshair size={17} />
      </IconButton>
    </div>
  );
}

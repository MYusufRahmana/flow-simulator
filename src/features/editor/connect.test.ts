import { describe, expect, it } from 'vitest';
import type { FlowNode, NodeKind } from '../../types/flow';
import { pickTargetHandle } from './connect';

const at = (x: number, y: number, type: NodeKind = 'process') =>
  ({ type, position: { x, y }, measured: { width: 232, height: 60 } }) as Pick<FlowNode, 'position' | 'measured' | 'type'>;

describe('pickTargetHandle', () => {
  it('enters from the top when the target is below', () => {
    expect(pickTargetHandle(at(0, 0), 'out', at(0, 120))).toBe('top');
    expect(pickTargetHandle(at(0, 0), 'true', at(40, 200))).toBe('top');
  });

  it('enters from the left when the target is to the right', () => {
    expect(pickTargetHandle(at(0, 0), 'out', at(300, 0))).toBe('left');
    expect(pickTargetHandle(at(0, 0), 'false', at(300, 120))).toBe('left');
    expect(pickTargetHandle(at(0, 0), 'fail', at(300, 300))).toBe('left');
  });

  it('enters an End on the left from its right side', () => {
    expect(pickTargetHandle(at(300, 0), 'out', at(0, 200, 'end'))).toBe('right');
  });

  it('falls back to the top for anything else', () => {
    expect(pickTargetHandle(at(300, 300), 'out', at(0, 0))).toBe('top');
  });
});

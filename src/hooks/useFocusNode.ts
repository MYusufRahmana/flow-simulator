import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '../stores/flowStore';

/** Select a node and smoothly bring it to the centre of the viewport. */
export function useFocusNode() {
  const { getNode, setCenter, getZoom } = useReactFlow();
  return (id: string) => {
    const node = getNode(id);
    if (!node) return;
    useFlowStore.getState().selectNode(id);
    const w = node.measured?.width ?? 232;
    const h = node.measured?.height ?? 60;
    void setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: Math.max(getZoom(), 0.9), duration: 400 });
  };
}

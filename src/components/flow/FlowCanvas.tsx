import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  ViewportPortal,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { useCallback, useEffect, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useFlowStore } from '../../stores/flowStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUiStore } from '../../stores/uiStore';
import type { FlowEdge as FlowEdgeType, FlowNode, NodeKind } from '../../types/flow';
import FlowEdge, { EdgeMarkers } from '../edges/FlowEdge';
import ConnectMenu, { type ConnectMenuState } from './ConnectMenu';
import ContextMenu, { type ContextMenuState } from './ContextMenu';
import FlowNodeCard from '../nodes/FlowNodeCard';
import FlowchartNode from '../nodes/FlowchartNode';
import { categoryOf, halfWidthOf, isFlowchartKind, NODE_KINDS, NODE_META } from '../nodes/registry';

export const DND_TYPE = 'application/x-flow-node';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const nodeTypes = Object.fromEntries(NODE_KINDS.map((k) => [k, isFlowchartKind(k) ? FlowchartNode : FlowNodeCard]));
const edgeTypes = { flow: FlowEdge };

export default function FlowCanvas() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const viewport = useFlowStore((s) => s.viewport);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const simActive = useSimulationStore((s) => s.active);
  const follow = useSimulationStore((s) => s.follow);
  const currentNodeIds = useSimulationStore((s) => s.currentNodeIds);
  const minimap = useUiStore((s) => s.minimap);
  const { screenToFlowPosition, setCenter, getNode, getZoom } = useReactFlow<FlowNode, FlowEdgeType>();
  const [connectMenu, setConnectMenu] = useState<ConnectMenuState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Right-click menu. Disabled while simulating, since the canvas is locked then.
  const openContextMenu = useCallback(
    (e: MouseEvent | ReactMouseEvent, target: DistributiveOmit<ContextMenuState, 'x' | 'y' | 'flowX' | 'flowY'>) => {
      e.preventDefault();
      if (useSimulationStore.getState().active) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setConnectMenu(null);
      setContextMenu({ ...target, x: e.clientX, y: e.clientY, flowX: p.x, flowY: p.y } as ContextMenuState);
    },
    [screenToFlowPosition],
  );
  const onNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: FlowNode) => {
      const flow = useFlowStore.getState();
      // Right-clicking inside a multi-selection acts on the whole selection.
      if (node.selected && flow.selectedNodeIds.length > 1) return openContextMenu(e, { target: 'selection' });
      flow.selectNode(node.id);
      openContextMenu(e, { target: 'node', id: node.id });
    },
    [openContextMenu],
  );
  const onEdgeContextMenu = useCallback(
    (e: ReactMouseEvent, edge: FlowEdgeType) => {
      useFlowStore.getState().selectEdge(edge.id);
      openContextMenu(e, { target: 'edge', id: edge.id });
    },
    [openContextMenu],
  );

  // Dropping a connection on empty canvas offers to create the next node right there.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || state.toNode || !state.fromNode || state.fromHandle?.type !== 'source') return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const p = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      setConnectMenu({
        x: point.clientX,
        y: point.clientY,
        flowX: p.x,
        flowY: p.y,
        source: state.fromNode.id,
        sourceHandle: state.fromHandle.id ?? null,
      });
    },
    [screenToFlowPosition],
  );

  const onPickConnected = useCallback(
    (kind: NodeKind) => {
      if (!connectMenu) return;
      const halfWidth = halfWidthOf(kind);
      // Line ending at the top centre of the new node, snapped to the grid.
      const position = {
        x: Math.round((connectMenu.flowX - halfWidth) / 12) * 12,
        y: Math.round(connectMenu.flowY / 12) * 12,
      };
      const id = useFlowStore.getState().addConnectedNode(kind, position, connectMenu.source, connectMenu.sourceHandle);
      if (isFlowchartKind(kind)) useUiStore.getState().startEditing(id);
      setConnectMenu(null);
    },
    [connectMenu],
  );

  // Keep the camera on the travelling token.
  useEffect(() => {
    if (!simActive || !follow || !currentNodeIds.length) return;
    const node = getNode(currentNodeIds[0]);
    if (!node) return;
    const w = node.measured?.width ?? 232;
    const h = node.measured?.height ?? 60;
    void setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: Math.max(getZoom(), 0.8), duration: 450 });
  }, [currentNodeIds, simActive, follow, getNode, setCenter, getZoom]);

  const isValidConnection = useCallback((c: Connection | Edge) => {
    const { nodes, edges } = useFlowStore.getState();
    if (c.source === c.target) return false;
    const source = nodes.find((n) => n.id === c.source);
    const target = nodes.find((n) => n.id === c.target);
    if (!source || !target) return false;
    if (target.type === 'start' || source.type === 'end') return false;
    // Simulation nodes and flowchart shapes are separate worlds.
    if (categoryOf(source.type) !== categoryOf(target.type)) return false;
    return !edges.some(
      (e) => e.source === c.source && e.target === c.target && (e.sourceHandle ?? null) === (c.sourceHandle ?? null),
    );
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes(DND_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const kind = e.dataTransfer.getData(DND_TYPE) as NodeKind;
      if (!kind || !NODE_META[kind]) return;
      e.preventDefault();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const halfWidth = halfWidthOf(kind);
      const id = useFlowStore.getState().addNode(kind, { x: Math.round((p.x - halfWidth) / 12) * 12, y: Math.round((p.y - 28) / 12) * 12 });
      if (isFlowchartKind(kind)) useUiStore.getState().startEditing(id);
    },
    [screenToFlowPosition],
  );

  const onSelectionChange = useCallback(({ nodes, edges }: OnSelectionChangeParams) => {
    useFlowStore.getState().setSelection(
      nodes.map((n) => n.id),
      edges.map((e) => e.id),
    );
  }, []);

  return (
    <ReactFlow<FlowNode, FlowEdgeType>
      className={simActive ? 'sim-locked' : ''}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      connectionRadius={36}
      onSelectionChange={onSelectionChange}
      onNodeContextMenu={onNodeContextMenu}
      onEdgeContextMenu={onEdgeContextMenu}
      onSelectionContextMenu={(e) => openContextMenu(e, { target: 'selection' })}
      onPaneContextMenu={(e) => openContextMenu(e, { target: 'pane' })}
      onNodeDragStart={() => useFlowStore.getState().pushHistory()}
      onMoveEnd={(_, vp) => useFlowStore.getState().setViewport(vp)}
      isValidConnection={isValidConnection}
      onDrop={onDrop}
      onDragOver={onDragOver}
      defaultViewport={viewport}
      fitView={!viewport}
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      minZoom={0.1}
      maxZoom={2.5}
      snapToGrid
      snapGrid={[12, 12]}
      nodesDraggable={!simActive}
      nodesConnectable={!simActive}
      elementsSelectable
      deleteKeyCode={null}
      selectionKeyCode="Shift"
      multiSelectionKeyCode={['Meta', 'Control']}
      connectionLineType={ConnectionLineType.SmoothStep}
      connectionLineStyle={{ stroke: '#2f5bff', strokeWidth: 1.5, strokeDasharray: '5 4' }}
      proOptions={{ hideAttribution: true }}
    >
      {/* Inside the viewport so image exports (which clone only the viewport) keep the arrowheads. */}
      <ViewportPortal>
        <EdgeMarkers />
      </ViewportPortal>
      <Background id="minor" variant={BackgroundVariant.Lines} gap={24} color="var(--color-grid)" lineWidth={1} />
      <Background
        id="major"
        variant={BackgroundVariant.Lines}
        gap={120}
        color="var(--color-grid-major)"
        lineWidth={1}
        bgColor="transparent"
      />
      {contextMenu && <ContextMenu menu={contextMenu} onClose={closeContextMenu} />}
      {connectMenu && <ConnectMenu menu={connectMenu} onPick={onPickConnected} onClose={() => setConnectMenu(null)} />}
      {minimap && (
        <MiniMap
          position="bottom-right"
          style={{ bottom: 64, right: 4 }}
          pannable
          zoomable
          nodeBorderRadius={6}
          nodeColor={(n) => NODE_META[(n.type ?? 'process') as NodeKind]?.color ?? '#999'}
          maskColor="rgb(242 242 242 / 0.7)"
          className="panel"
        />
      )}
    </ReactFlow>
  );
}

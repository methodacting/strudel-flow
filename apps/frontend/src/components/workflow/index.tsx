import { Background, ReactFlow } from '@xyflow/react';
import type { Edge, ReactFlowInstance } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { useCallback, useRef } from 'react';

import { nodeTypes } from '@/components/nodes';
import { edgeTypes } from '@/components/edges';
import { useAppStore } from '@/store/app-context';
import { WorkflowControls } from './controls';
import { CursorOverlay } from './cursor-overlay';
import { useDragAndDrop } from './useDragAndDrop';
import { useGlobalPlayback } from '@/hooks/use-global-playback';
import { useThemeCss } from '@/hooks/use-theme-css';
import type { UseYjsSyncResult } from '@/hooks/use-yjs-sync';
import type { AppNode } from '@/components/nodes';

type WorkflowProps = {
  projectId: string;
  isReadOnly: boolean;
  awareness?: UseYjsSyncResult;
  isAuthenticated: boolean;
};

export default function Workflow({ projectId, isReadOnly, awareness, isAuthenticated }: WorkflowProps) {
  useGlobalPlayback(); // Enable global spacebar pause/play

  const reactFlowInstance = useRef<ReactFlowInstance<AppNode, Edge> | null>(null);

  const {
    nodes,
    edges,
    colorMode,
    theme,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDragStart,
    onNodeDragStop,
  } = useAppStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      colorMode: state.colorMode,
      theme: state.theme,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
      onNodeDragStart: state.onNodeDragStart,
      onNodeDragStop: state.onNodeDragStop,
    }))
  );

  // Load theme CSS at the app level - fixes mobile color loading
  useThemeCss(theme);

  const { onDragOver, onDrop } = useDragAndDrop();

  // Track cursor movement for awareness
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!reactFlowInstance.current || !awareness) return;

    // Get position relative to the ReactFlow container
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Calculate position relative to the viewport (what awareness expects)
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    awareness.updateCursor(x, y);
  }, [awareness]);

  return (
    <div className="reactflow-wrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeDragThreshold={30}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        colorMode={colorMode}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable={!isReadOnly}
        fitView
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        onMouseMove={handleMouseMove}
      >
        <Background />
        <WorkflowControls
          projectId={projectId}
          awareness={awareness}
          isAuthenticated={isAuthenticated}
        />
        {awareness && (
          <CursorOverlay
            remoteUsers={awareness.remoteUsers}
            reactFlowInstance={reactFlowInstance.current}
          />
        )}
      </ReactFlow>
    </div>
  );
}

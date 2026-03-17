import { useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

import {
  useAppStore,
  type AppState,
} from '@/store/useAppStore';

import { LegendBar } from './components/LegendBar';
import { SchemaScreenshotPreview } from './components/SchemaScreenshotPreview';
import { SchemaVisualizationToolbar } from './components/SchemaVisualizationToolbar';
import { SchemaVisualizationViewport } from './components/SchemaVisualizationViewport';
import { DEFAULT_PAN, DEFAULT_ZOOM } from './lib/constants';
import { buildDefaultPositions } from './lib/helpers';
import type { VisualizationViewState } from './lib/types';
import { useRelationshipLayout } from './hooks/useRelationshipLayout';
import { useSchemaScreenshot } from './hooks/useSchemaScreenshot';
import { useSchemaViewport } from './hooks/useSchemaViewport';
import { useVisualizedTables } from './hooks/useVisualizedTables';

interface SchemaVisualizationProps {
  tabId: string;
}

const selectTabs = (state: AppState) => state.tabs;
const selectConnections = (state: AppState) => state.connections;
const selectUpdateVisualizationState = (state: AppState) => state.updateVisualizationState;
const selectSetVisualizationTablePosition = (state: AppState) => state.setVisualizationTablePosition;
const selectShowToast = (state: AppState) => state.showToast;

export default function SchemaVisualization({ tabId }: SchemaVisualizationProps) {
  const tabs = useAppStore(selectTabs);
  const connections = useAppStore(selectConnections);
  const visualizationState = useAppStore((state) => state.visualizationStateByTabId[tabId]);
  const updateVisualizationState = useAppStore(selectUpdateVisualizationState);
  const setVisualizationTablePosition = useAppStore(selectSetVisualizationTablePosition);
  const showToast = useAppStore(selectShowToast);

  const tab = useMemo(() => tabs.find((item) => item.id === tabId) ?? null, [tabs, tabId]);
  const connection = useMemo(
    () => connections.find((item) => item.id === tab?.connectionId) ?? null,
    [connections, tab?.connectionId],
  );
  const connId = connection?.connId ?? null;

  const { error, failedTables, loading, relationships, tables } = useVisualizedTables({
    connId,
    connectionType: connection?.type,
    schemaName: tab?.schemaName ?? null,
    sourceTable: tab?.visualizeSourceTable ?? null,
  });

  const viewRef = useRef<VisualizationViewState>({
    pan: { ...(visualizationState?.pan ?? DEFAULT_PAN) },
    positionsByTable: { ...(visualizationState?.positionsByTable ?? {}) },
    zoom: visualizationState?.zoom ?? DEFAULT_ZOOM,
  });
  const defaultPositions = useMemo(() => buildDefaultPositions(tables), [tables]);

  const {
    applyCardTransform,
    applyRelationshipPathsForTable,
    canvasRef,
    getFallbackRelationshipGeometry,
    getResolvedPosition,
    relationshipEndpointRefs,
    relationshipGlowRefs,
    relationshipRefs,
    rowRefs,
    setCardRef,
  } = useRelationshipLayout({
    defaultPositions,
    persistedPositionsByTable: visualizationState?.positionsByTable,
    relationships,
    tables,
    viewRef,
  });

  const {
    adjustZoom,
    canvasPan,
    canvasZoom,
    handleCanvasPointerDown,
    handleCardPointerDown,
    handleViewportWheel,
    resetCanvasView,
    viewportRef,
  } = useSchemaViewport({
    applyCardTransform,
    applyRelationshipPathsForTable,
    canvasRef,
    getResolvedPosition,
    setVisualizationTablePosition,
    tabId,
    updateVisualizationState,
    viewRef,
    visualizationState,
  });

  const {
    capturingScreenshot,
    clearScreenshotPreview,
    copyingScreenshot,
    handleCaptureScreenshot,
    handleCopyScreenshot,
    screenshotPreview,
  } = useSchemaScreenshot({
    showToast,
    viewportRef,
  });

  const scopeLabel = useMemo(() => {
    if (!connection) {
      return tab?.schemaName?.trim() || 'main';
    }

    if (connection.type === 'postgres') {
      return tab?.schemaName?.trim() || 'All Schemas';
    }

    return tab?.schemaName?.trim() || 'main';
  }, [connection, tab?.schemaName]);

  const captureDisabled =
    loading || !!error || tables.length === 0 || capturingScreenshot || copyingScreenshot;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <SchemaVisualizationToolbar
        capturingScreenshot={capturingScreenshot}
        captureDisabled={captureDisabled}
        connectionType={connection?.type}
        onCapture={() => {
          void handleCaptureScreenshot();
        }}
        onResetView={resetCanvasView}
        onZoomIn={() => adjustZoom(0.1)}
        onZoomOut={() => adjustZoom(-0.1)}
        relationshipCount={relationships.length}
        schemaName={tab?.schemaName}
        scopeLabel={scopeLabel}
        tableCount={tables.length}
        zoom={canvasZoom}
      />

      <LegendBar />

      {failedTables.length > 0 && (
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <AlertTriangle size={13} />
          <span>
            Failed to load {failedTables.length} table
            {failedTables.length === 1 ? '' : 's'}.
          </span>
        </div>
      )}

      {error ? (
        <div className="m-4 rounded-sm border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <SchemaVisualizationViewport
        canvasPanX={canvasPan.x}
        canvasPanY={canvasPan.y}
        canvasRef={canvasRef}
        canvasZoom={canvasZoom}
        connectionType={connection?.type}
        error={error}
        getCardPosition={getResolvedPosition}
        getRelationshipGeometry={getFallbackRelationshipGeometry}
        handleCanvasPointerDown={handleCanvasPointerDown}
        handleCardPointerDown={handleCardPointerDown}
        handleViewportWheel={handleViewportWheel}
        loading={loading}
        relationshipEndpointRefs={relationshipEndpointRefs}
        relationshipGlowRefs={relationshipGlowRefs}
        relationshipRefs={relationshipRefs}
        relationships={relationships}
        rowRefs={rowRefs}
        setCardRef={setCardRef}
        tables={tables}
        viewportRef={viewportRef}
      />

      {screenshotPreview ? (
        <SchemaScreenshotPreview
          copying={copyingScreenshot}
          onClear={clearScreenshotPreview}
          onCopy={() => {
            void handleCopyScreenshot();
          }}
          preview={screenshotPreview}
        />
      ) : null}
    </div>
  );
}

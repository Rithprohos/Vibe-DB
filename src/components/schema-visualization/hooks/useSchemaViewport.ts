import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from 'react';

import type { VisualizationPoint, VisualizationState } from '@/store/useAppStore';

import { DEFAULT_PAN, DEFAULT_ZOOM, VIEW_PERSIST_DELAY_MS } from '../lib/constants';
import { clampZoom } from '../lib/helpers';
import type { VisualizationViewState } from '../lib/types';

type InteractionState =
  | {
      mode: 'pan';
      startPan: VisualizationPoint;
      startPointer: VisualizationPoint;
    }
  | {
      mode: 'drag';
      startPointer: VisualizationPoint;
      startPosition: VisualizationPoint;
      tableName: string;
    };

interface UseSchemaViewportOptions {
  applyCardTransform: (tableName: string, position: VisualizationPoint) => void;
  applyRelationshipPathsForTable: (tableName: string) => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  getResolvedPosition: (tableName: string) => VisualizationPoint;
  setVisualizationTablePosition: (
    tabId: string,
    tableName: string,
    position: VisualizationPoint,
  ) => void;
  tabId: string;
  updateVisualizationState: (
    tabId: string,
    updates: Partial<VisualizationState>,
  ) => void;
  viewRef: MutableRefObject<VisualizationViewState>;
  visualizationState: VisualizationState | undefined;
}

export function useSchemaViewport({
  applyCardTransform,
  applyRelationshipPathsForTable,
  canvasRef,
  getResolvedPosition,
  setVisualizationTablePosition,
  tabId,
  updateVisualizationState,
  viewRef,
  visualizationState,
}: UseSchemaViewportOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const pointerRef = useRef<VisualizationPoint | null>(null);
  const frameRef = useRef<number | null>(null);
  const persistViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasPan = visualizationState?.pan ?? DEFAULT_PAN;
  const canvasZoom = visualizationState?.zoom ?? DEFAULT_ZOOM;

  const applyCanvasTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    if (!canvasRef.current) {
      return;
    }

    canvasRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }, [canvasRef]);

  const clearPersistViewTimeout = useCallback(() => {
    if (persistViewTimeoutRef.current === null) {
      return;
    }

    clearTimeout(persistViewTimeoutRef.current);
    persistViewTimeoutRef.current = null;
  }, []);

  const persistViewTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    updateVisualizationState(tabId, { pan, zoom });
  }, [tabId, updateVisualizationState]);

  const setLiveViewTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    viewRef.current.pan = pan;
    viewRef.current.zoom = zoom;
    applyCanvasTransform(pan, zoom);
  }, [applyCanvasTransform, viewRef]);

  const commitViewTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    clearPersistViewTimeout();
    setLiveViewTransform(pan, zoom);
    persistViewTransform(pan, zoom);
  }, [clearPersistViewTimeout, persistViewTransform, setLiveViewTransform]);

  const schedulePersistedViewTransform = useCallback(
    (pan: VisualizationPoint, zoom: number) => {
      clearPersistViewTimeout();
      setLiveViewTransform(pan, zoom);
      persistViewTimeoutRef.current = setTimeout(() => {
        persistViewTimeoutRef.current = null;
        persistViewTransform(pan, zoom);
      }, VIEW_PERSIST_DELAY_MS);
    },
    [clearPersistViewTimeout, persistViewTransform, setLiveViewTransform],
  );

  const renderInteractionFrame = useCallback(() => {
    frameRef.current = null;

    const interaction = interactionRef.current;
    const pointer = pointerRef.current;
    if (!interaction || !pointer) {
      return;
    }

    if (interaction.mode === 'pan') {
      setLiveViewTransform(
        {
          x: interaction.startPan.x + pointer.x - interaction.startPointer.x,
          y: interaction.startPan.y + pointer.y - interaction.startPointer.y,
        },
        viewRef.current.zoom,
      );
      return;
    }

    const nextPosition = {
      x: interaction.startPosition.x + pointer.x - interaction.startPointer.x,
      y: interaction.startPosition.y + pointer.y - interaction.startPointer.y,
    };

    viewRef.current.positionsByTable[interaction.tableName] = nextPosition;
    applyCardTransform(interaction.tableName, nextPosition);
    applyRelationshipPathsForTable(interaction.tableName);
  }, [applyCardTransform, applyRelationshipPathsForTable, setLiveViewTransform, viewRef]);

  const queueInteractionFrame = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(renderInteractionFrame);
  }, [renderInteractionFrame]);

  const finishInteraction = useCallback(() => {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      renderInteractionFrame();
    }

    if (interaction.mode === 'pan') {
      clearPersistViewTimeout();
      updateVisualizationState(tabId, {
        pan: viewRef.current.pan,
        zoom: viewRef.current.zoom,
      });
    } else {
      setVisualizationTablePosition(
        tabId,
        interaction.tableName,
        getResolvedPosition(interaction.tableName),
      );
    }

    interactionRef.current = null;
    pointerRef.current = null;
    document.body.classList.remove('select-none', 'cursor-grabbing');
  }, [
    clearPersistViewTimeout,
    getResolvedPosition,
    renderInteractionFrame,
    setVisualizationTablePosition,
    tabId,
    updateVisualizationState,
    viewRef,
  ]);

  const zoomAroundViewportPoint = useCallback(
    (clientPoint: VisualizationPoint, nextZoom: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const focalPoint = {
        x: clientPoint.x - rect.left,
        y: clientPoint.y - rect.top,
      };
      const worldX = (focalPoint.x - viewRef.current.pan.x) / viewRef.current.zoom;
      const worldY = (focalPoint.y - viewRef.current.pan.y) / viewRef.current.zoom;

      schedulePersistedViewTransform(
        {
          x: focalPoint.x - worldX * nextZoom,
          y: focalPoint.y - worldY * nextZoom,
        },
        nextZoom,
      );
    },
    [schedulePersistedViewTransform, viewRef],
  );

  const adjustZoom = useCallback((delta: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const nextZoom = clampZoom(viewRef.current.zoom + delta);
    if (nextZoom === viewRef.current.zoom) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    zoomAroundViewportPoint(
      {
        x: rect.left + viewport.clientWidth / 2,
        y: rect.top + viewport.clientHeight / 2,
      },
      nextZoom,
    );
  }, [viewRef, zoomAroundViewportPoint]);

  const resetCanvasView = useCallback(() => {
    commitViewTransform(DEFAULT_PAN, DEFAULT_ZOOM);
  }, [commitViewTransform]);

  const handleViewportWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const nextZoom = clampZoom(viewRef.current.zoom - event.deltaY * 0.0025);
      if (nextZoom !== viewRef.current.zoom) {
        zoomAroundViewportPoint({ x: event.clientX, y: event.clientY }, nextZoom);
      }
      return;
    }

    schedulePersistedViewTransform(
      {
        x: viewRef.current.pan.x - event.deltaX,
        y: viewRef.current.pan.y - event.deltaY,
      },
      viewRef.current.zoom,
    );
  }, [schedulePersistedViewTransform, viewRef, zoomAroundViewportPoint]);

  const handleCanvasPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    interactionRef.current = {
      mode: 'pan',
      startPan: { ...viewRef.current.pan },
      startPointer: { x: event.clientX, y: event.clientY },
    };
    pointerRef.current = { x: event.clientX, y: event.clientY };
    document.body.classList.add('select-none', 'cursor-grabbing');
  }, [viewRef]);

  const handleCardPointerDown = useCallback((
    tableName: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      mode: 'drag',
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: getResolvedPosition(tableName),
      tableName,
    };
    pointerRef.current = { x: event.clientX, y: event.clientY };
    document.body.classList.add('select-none', 'cursor-grabbing');
  }, [getResolvedPosition]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!interactionRef.current) {
        return;
      }

      pointerRef.current = { x: event.clientX, y: event.clientY };
      queueInteractionFrame();
    };

    const handlePointerUp = () => {
      finishInteraction();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
    };
  }, [finishInteraction, queueInteractionFrame]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (persistViewTimeoutRef.current !== null) {
        clearTimeout(persistViewTimeoutRef.current);
      }
      document.body.classList.remove('select-none', 'cursor-grabbing');
    };
  }, []);

  useLayoutEffect(() => {
    setLiveViewTransform(canvasPan, canvasZoom);
  }, [canvasPan, canvasZoom, setLiveViewTransform]);

  return {
    adjustZoom,
    canvasPan,
    canvasZoom,
    handleCanvasPointerDown,
    handleCardPointerDown,
    handleViewportWheel,
    resetCanvasView,
    viewportRef,
  };
}

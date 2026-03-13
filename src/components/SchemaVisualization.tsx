import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AlertTriangle,
  Database,
  Diamond,
  Fingerprint,
  Hash,
  Key,
  Link2,
  Loader2,
  Minus,
  Move,
  Plus,
  RotateCcw,
} from 'lucide-react';

import { getTableStructure, listTables } from '@/lib/db';
import {
  getQualifiedTableName,
  getSchemaName,
  splitQualifiedTableName,
} from '@/lib/databaseObjects';
import { isSchemaFlagDisabled, isSchemaFlagEnabled } from '@/lib/schemaFlags';
import { formatColumnTypeDisplay } from '@/lib/typeDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAppStore, type AppState, type TableInfo, type VisualizationPoint } from '@/store/useAppStore';

interface SchemaVisualizationProps {
  tabId: string;
}

interface VisualizedColumn {
  name: string;
  typeLabel: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isNullable: boolean;
  isIdentity: boolean;
}

interface VisualizedForeignKey {
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

interface VisualizedTable {
  qualifiedName: string;
  tableName: string;
  schemaName: string | null;
  columns: VisualizedColumn[];
  foreignKeys: VisualizedForeignKey[];
}

interface VisualRelationship {
  key: string;
  sourceTableName: string;
  sourceColumnIndex: number;
  targetTableName: string;
  targetColumnIndex: number;
}

type InteractionState =
  | {
      mode: 'pan';
      startPointer: VisualizationPoint;
      startPan: VisualizationPoint;
    }
  | {
      mode: 'drag';
      tableName: string;
      startPointer: VisualizationPoint;
      startPosition: VisualizationPoint;
    };

const CARD_WIDTH = 280;
const CARD_GAP_X = 40;
const CARD_GAP_Y = 72;
const CARD_HEADER_HEIGHT = 76;
const CARD_ROW_HEIGHT = 46;
const DEFAULT_PAN: VisualizationPoint = { x: 88, y: 88 };
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.8;
const STRUCTURE_FETCH_BATCH_SIZE = 10;
const VIEW_PERSIST_DELAY_MS = 120;

const selectTabs = (state: AppState) => state.tabs;
const selectConnections = (state: AppState) => state.connections;
const selectUpdateVisualizationState = (state: AppState) => state.updateVisualizationState;
const selectSetVisualizationTablePosition = (state: AppState) => state.setVisualizationTablePosition;

function ConstraintDot({ filled }: { filled: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rotate-45 border border-current',
        filled ? 'bg-current' : 'bg-transparent',
      )}
      aria-hidden="true"
    />
  );
}

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));
}

async function fetchStructuresInBatches(
  tables: TableInfo[],
  connId: string,
): Promise<PromiseSettledResult<Awaited<ReturnType<typeof getTableStructure>>>[]> {
  const results: PromiseSettledResult<Awaited<ReturnType<typeof getTableStructure>>>[] = [];

  for (let index = 0; index < tables.length; index += STRUCTURE_FETCH_BATCH_SIZE) {
    const batch = tables.slice(index, index + STRUCTURE_FETCH_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((table) => getTableStructure(getQualifiedTableName(table), connId)),
    );
    results.push(...batchResults);
  }

  return results;
}

function matchesVisualizationScope(
  table: TableInfo,
  connectionType: AppState['connections'][number]['type'],
  schemaName: string | null | undefined,
): boolean {
  if (connectionType !== 'postgres') {
    return table.table_type === 'table';
  }

  if (table.table_type !== 'table') {
    return false;
  }

  if (!schemaName) {
    return true;
  }

  return getSchemaName(table) === schemaName;
}

function sortVisualizationTables(
  tables: TableInfo[],
  sourceTable: string | null | undefined,
): TableInfo[] {
  const trimmedSource = sourceTable?.trim() ?? '';

  return [...tables].sort((left, right) => {
    const leftQualified = getQualifiedTableName(left);
    const rightQualified = getQualifiedTableName(right);

    if (trimmedSource) {
      const leftScore = leftQualified === trimmedSource ? 0 : 1;
      const rightScore = rightQualified === trimmedSource ? 0 : 1;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }
    }

    return leftQualified.localeCompare(rightQualified);
  });
}

function buildDefaultPositions(tables: VisualizedTable[]): Record<string, VisualizationPoint> {
  if (tables.length === 0) {
    return {};
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  const positions: Record<string, VisualizationPoint> = {};
  const rowHeights = Array.from({ length: Math.ceil(tables.length / columns) }, () => 0);

  tables.forEach((table, index) => {
    const row = Math.floor(index / columns);
    const estimatedHeight = CARD_HEADER_HEIGHT + table.columns.length * CARD_ROW_HEIGHT;
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, estimatedHeight);
  });

  const rowOffsets = rowHeights.reduce<number[]>((offsets, _height, index) => {
    if (index === 0) {
      offsets.push(0);
      return offsets;
    }

    offsets.push(offsets[index - 1] + rowHeights[index - 1] + CARD_GAP_Y);
    return offsets;
  }, []);

  tables.forEach((table, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    positions[table.qualifiedName] = {
      x: column * (CARD_WIDTH + CARD_GAP_X),
      y: rowOffsets[row] ?? 0,
    };
  });

  return positions;
}

export default function SchemaVisualization({ tabId }: SchemaVisualizationProps) {
  const tabs = useAppStore(selectTabs);
  const connections = useAppStore(selectConnections);
  const visualizationState = useAppStore((state) => state.visualizationStateByTabId[tabId]);
  const updateVisualizationState = useAppStore(selectUpdateVisualizationState);
  const setVisualizationTablePosition = useAppStore(selectSetVisualizationTablePosition);

  const tab = useMemo(() => tabs.find((item) => item.id === tabId) ?? null, [tabs, tabId]);
  const connection = useMemo(
    () => connections.find((item) => item.id === tab?.connectionId) ?? null,
    [connections, tab?.connectionId],
  );
  const connId = connection?.connId ?? null;

  const [tables, setTables] = useState<VisualizedTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedTables, setFailedTables] = useState<string[]>([]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const relationshipRefs = useRef<Record<string, SVGPathElement | null>>({});
  const defaultPositionsRef = useRef<Record<string, VisualizationPoint>>({});
  const persistedPositionsRef = useRef<Record<string, VisualizationPoint>>({});
  const interactionRef = useRef<InteractionState | null>(null);
  const pointerRef = useRef<VisualizationPoint | null>(null);
  const frameRef = useRef<number | null>(null);
  const persistViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRef = useRef({
    pan: visualizationState?.pan ?? DEFAULT_PAN,
    zoom: visualizationState?.zoom ?? DEFAULT_ZOOM,
    positionsByTable: { ...(visualizationState?.positionsByTable ?? {}) },
  });

  const relationships = useMemo(() => {
    const tableByQualifiedName = new Map(tables.map((table) => [table.qualifiedName, table]));
    const qualifiedNamesByTableName = new Map<string, string[]>();

    tables.forEach((table) => {
      const matches = qualifiedNamesByTableName.get(table.tableName) ?? [];
      matches.push(table.qualifiedName);
      qualifiedNamesByTableName.set(table.tableName, matches);
    });

    const resolveTargetTable = (sourceTable: VisualizedTable, targetTableName: string): string | null => {
      const splitTarget = splitQualifiedTableName(targetTableName);
      if (splitTarget.schema) {
        const qualifiedTarget = `${splitTarget.schema}.${splitTarget.name}`;
        return tableByQualifiedName.has(qualifiedTarget) ? qualifiedTarget : null;
      }

      if (sourceTable.schemaName) {
        const sameSchemaTarget = `${sourceTable.schemaName}.${targetTableName}`;
        if (tableByQualifiedName.has(sameSchemaTarget)) {
          return sameSchemaTarget;
        }
      }

      if (tableByQualifiedName.has(targetTableName)) {
        return targetTableName;
      }

      const nameMatches = qualifiedNamesByTableName.get(targetTableName) ?? [];
      return nameMatches.length === 1 ? nameMatches[0] : null;
    };

    return tables.flatMap((table) =>
      table.foreignKeys.flatMap((foreignKey) => {
        const targetQualifiedName = resolveTargetTable(table, foreignKey.toTable);
        if (!targetQualifiedName) {
          return [];
        }

        const targetTable = tableByQualifiedName.get(targetQualifiedName);
        if (!targetTable) {
          return [];
        }

        const sourceColumnIndex = table.columns.findIndex(
          (column) => column.name === foreignKey.fromColumn,
        );
        const targetColumnIndex = targetTable.columns.findIndex(
          (column) => column.name === foreignKey.toColumn,
        );

        if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
          return [];
        }

        return [
          {
            key: `${table.qualifiedName}:${foreignKey.fromColumn}->${targetQualifiedName}:${foreignKey.toColumn}`,
            sourceTableName: table.qualifiedName,
            sourceColumnIndex,
            targetTableName: targetQualifiedName,
            targetColumnIndex,
          },
        ];
      }),
    );
  }, [tables]);

  const scopeLabel = useMemo(() => {
    if (!connection) {
      return tab?.schemaName?.trim() || 'main';
    }

    if (connection.type === 'postgres') {
      return tab?.schemaName?.trim() || 'All Schemas';
    }

    return tab?.schemaName?.trim() || 'main';
  }, [connection, tab?.schemaName]);

  useEffect(() => {
    if (!connId || !connection) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setFailedTables([]);

    void (async () => {
      try {
        const availableTables = await listTables(connId);
        const scopedTables = sortVisualizationTables(
          availableTables.filter((table) =>
            matchesVisualizationScope(table, connection.type, tab?.schemaName ?? null),
          ),
          tab?.visualizeSourceTable ?? null,
        );

        const structures = await fetchStructuresInBatches(scopedTables, connId);

        if (cancelled) {
          return;
        }

        const nextFailedTables: string[] = [];
        const nextTables: VisualizedTable[] = [];

        structures.forEach((result, index) => {
          const table = scopedTables[index];
          const qualifiedName = getQualifiedTableName(table);

          if (result.status === 'rejected') {
            nextFailedTables.push(qualifiedName);
            return;
          }

          const foreignKeyColumns = new Set(
            result.value.foreign_keys.map((foreignKey) => foreignKey.from_col),
          );
          const uniqueColumns = new Set(
            result.value.indexes
              .filter((index) => index.unique && index.columns.length === 1)
              .map((index) => index.columns[0]),
          );

          nextTables.push({
            qualifiedName,
            tableName: table.name,
            schemaName: getSchemaName(table),
            columns: result.value.columns.map((column) => ({
              name: column.name,
              typeLabel: formatColumnTypeDisplay(column.col_type),
              isPrimaryKey: isSchemaFlagEnabled(column.pk),
              isForeignKey: foreignKeyColumns.has(column.name),
              isUnique: uniqueColumns.has(column.name),
              isNullable: isSchemaFlagDisabled(column.notnull),
              isIdentity: isSchemaFlagEnabled(column.pk) && /(int|serial)/i.test(column.col_type),
            })),
            foreignKeys: result.value.foreign_keys.map((foreignKey) => ({
              fromColumn: foreignKey.from_col,
              toTable: foreignKey.to_table,
              toColumn: foreignKey.to_col,
            })),
          });
        });

        startTransition(() => {
          setTables(nextTables);
          setFailedTables(nextFailedTables);
        });
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connId, connection?.type, tab?.schemaName, tab?.visualizeSourceTable]);

  const defaultPositions = useMemo(() => buildDefaultPositions(tables), [tables]);

  const canvasPan = visualizationState?.pan ?? DEFAULT_PAN;
  const canvasZoom = visualizationState?.zoom ?? DEFAULT_ZOOM;

  const applyCanvasTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    if (!canvasRef.current) {
      return;
    }

    canvasRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }, []);

  const applyCardTransform = useCallback((tableName: string, position: VisualizationPoint) => {
    const node = cardRefs.current[tableName];
    if (!node) {
      return;
    }

    node.style.transform = `translate(${position.x}px, ${position.y}px)`;
  }, []);

  const getResolvedPosition = useCallback((tableName: string): VisualizationPoint => {
    return (
      viewRef.current.positionsByTable[tableName] ??
      defaultPositionsRef.current[tableName] ?? { x: 0, y: 0 }
    );
  }, []);

  const buildRelationshipPath = useCallback((relationship: VisualRelationship): string => {
    const sourcePosition = getResolvedPosition(relationship.sourceTableName);
    const targetPosition = getResolvedPosition(relationship.targetTableName);

    const sourceCenterX = sourcePosition.x + CARD_WIDTH / 2;
    const targetCenterX = targetPosition.x + CARD_WIDTH / 2;
    const sourceOnLeft = sourceCenterX <= targetCenterX;
    const sourceX = sourcePosition.x + (sourceOnLeft ? CARD_WIDTH : 0);
    const targetX = targetPosition.x + (sourceOnLeft ? 0 : CARD_WIDTH);
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const zoom = viewRef.current.zoom || 1;
    const sourceRowRef =
      rowRefs.current[
        `${relationship.sourceTableName}:${relationship.sourceColumnIndex}`
      ];
    const targetRowRef =
      rowRefs.current[
        `${relationship.targetTableName}:${relationship.targetColumnIndex}`
      ];
    const sourceRowRect = sourceRowRef?.getBoundingClientRect();
    const targetRowRect = targetRowRef?.getBoundingClientRect();

    const sourceY = sourceRowRect && canvasRect
      ? (sourceRowRect.top +
          sourceRowRect.height / 2 -
          canvasRect.top) /
        zoom
      : sourcePosition.y +
        CARD_HEADER_HEIGHT +
        relationship.sourceColumnIndex * CARD_ROW_HEIGHT +
        CARD_ROW_HEIGHT / 2;
    const targetY = targetRowRect && canvasRect
      ? (targetRowRect.top +
          targetRowRect.height / 2 -
          canvasRect.top) /
        zoom
      : targetPosition.y +
        CARD_HEADER_HEIGHT +
        relationship.targetColumnIndex * CARD_ROW_HEIGHT +
        CARD_ROW_HEIGHT / 2;
    const horizontalGap = Math.max(Math.abs(targetX - sourceX) / 2, 40);
    const midX = sourceOnLeft ? sourceX + horizontalGap : sourceX - horizontalGap;

    return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
  }, [getResolvedPosition]);

  const applyRelationshipPath = useCallback((relationship: VisualRelationship) => {
    const pathNode = relationshipRefs.current[relationship.key];
    if (!pathNode) {
      return;
    }

    pathNode.setAttribute('d', buildRelationshipPath(relationship));
  }, [buildRelationshipPath]);

  const applyRelationshipPathsForTable = useCallback((tableName: string) => {
    relationships.forEach((relationship) => {
      if (
        relationship.sourceTableName === tableName ||
        relationship.targetTableName === tableName
      ) {
        applyRelationshipPath(relationship);
      }
    });
  }, [applyRelationshipPath, relationships]);

  const applyAllRelationshipPaths = useCallback(() => {
    relationships.forEach((relationship) => {
      applyRelationshipPath(relationship);
    });
  }, [applyRelationshipPath, relationships]);

  const persistViewTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    updateVisualizationState(tabId, { pan, zoom });
  }, [tabId, updateVisualizationState]);

  const clearPersistViewTimeout = useCallback(() => {
    if (persistViewTimeoutRef.current === null) {
      return;
    }

    clearTimeout(persistViewTimeoutRef.current);
    persistViewTimeoutRef.current = null;
  }, []);

  const setLiveViewTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    viewRef.current.pan = pan;
    viewRef.current.zoom = zoom;
    applyCanvasTransform(pan, zoom);
  }, [applyCanvasTransform, tabId, updateVisualizationState]);

  const commitViewTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    clearPersistViewTimeout();
    setLiveViewTransform(pan, zoom);
    persistViewTransform(pan, zoom);
  }, [clearPersistViewTimeout, persistViewTransform, setLiveViewTransform]);

  const schedulePersistedViewTransform = useCallback((pan: VisualizationPoint, zoom: number) => {
    clearPersistViewTimeout();
    setLiveViewTransform(pan, zoom);
    persistViewTimeoutRef.current = setTimeout(() => {
      persistViewTimeoutRef.current = null;
      persistViewTransform(pan, zoom);
    }, VIEW_PERSIST_DELAY_MS);
  }, [clearPersistViewTimeout, persistViewTransform, setLiveViewTransform]);

  const renderInteractionFrame = useCallback(() => {
    frameRef.current = null;

    const interaction = interactionRef.current;
    const pointer = pointerRef.current;
    if (!interaction || !pointer) {
      return;
    }

    if (interaction.mode === 'pan') {
      const nextPan = {
        x: interaction.startPan.x + pointer.x - interaction.startPointer.x,
        y: interaction.startPan.y + pointer.y - interaction.startPointer.y,
      };

      setLiveViewTransform(nextPan, viewRef.current.zoom);
      return;
    }

    const nextPosition = {
      x: interaction.startPosition.x + pointer.x - interaction.startPointer.x,
      y: interaction.startPosition.y + pointer.y - interaction.startPointer.y,
    };

    viewRef.current.positionsByTable[interaction.tableName] = nextPosition;
    applyCardTransform(interaction.tableName, nextPosition);
    applyRelationshipPathsForTable(interaction.tableName);
  }, [applyCardTransform, applyRelationshipPathsForTable, setLiveViewTransform]);

  const queueInteractionFrame = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(renderInteractionFrame);
  }, [renderInteractionFrame]);

  const resetCanvasView = useCallback(() => {
    commitViewTransform(DEFAULT_PAN, DEFAULT_ZOOM);
  }, [commitViewTransform]);

  const zoomAroundViewportPoint = useCallback((
    clientPoint: VisualizationPoint,
    nextZoom: number,
  ) => {
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
    const nextPan = {
      x: focalPoint.x - worldX * nextZoom,
      y: focalPoint.y - worldY * nextZoom,
    };

    schedulePersistedViewTransform(nextPan, nextZoom);
  }, [schedulePersistedViewTransform]);

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
  }, [zoomAroundViewportPoint]);

  const handleViewportWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const zoomDelta = clampZoom(viewRef.current.zoom - event.deltaY * 0.0025);
      if (zoomDelta !== viewRef.current.zoom) {
        zoomAroundViewportPoint(
          { x: event.clientX, y: event.clientY },
          zoomDelta,
        );
      }
      return;
    }

    const nextPan = {
      x: viewRef.current.pan.x - event.deltaX,
      y: viewRef.current.pan.y - event.deltaY,
    };
    schedulePersistedViewTransform(nextPan, viewRef.current.zoom);
  }, [schedulePersistedViewTransform, zoomAroundViewportPoint]);

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
  ]);

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

  useEffect(() => {
    defaultPositionsRef.current = defaultPositions;
  }, [defaultPositions]);

  useEffect(() => {
    setLiveViewTransform(canvasPan, canvasZoom);
  }, [
    canvasPan,
    canvasZoom,
    setLiveViewTransform,
  ]);

  useEffect(() => {
    const nextPersistedPositions = visualizationState?.positionsByTable ?? {};
    const previousPersistedPositions = persistedPositionsRef.current;

    Object.entries(nextPersistedPositions).forEach(([tableName, position]) => {
      const previousPosition = previousPersistedPositions[tableName];
      if (
        previousPosition &&
        previousPosition.x === position.x &&
        previousPosition.y === position.y
      ) {
        return;
      }

      viewRef.current.positionsByTable[tableName] = position;
      applyCardTransform(tableName, position);
      applyRelationshipPathsForTable(tableName);
    });

    persistedPositionsRef.current = nextPersistedPositions;
  }, [applyCardTransform, applyRelationshipPathsForTable, visualizationState?.positionsByTable]);

  useEffect(() => {
    tables.forEach((table) => {
      const position =
        viewRef.current.positionsByTable[table.qualifiedName] ??
        defaultPositions[table.qualifiedName] ?? { x: 0, y: 0 };
      applyCardTransform(
        table.qualifiedName,
        position,
      );
    });
    applyAllRelationshipPaths();
  }, [applyAllRelationshipPaths, applyCardTransform, defaultPositions, tables]);

  const handleCanvasPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    interactionRef.current = {
      mode: 'pan',
      startPointer: { x: event.clientX, y: event.clientY },
      startPan: { ...viewRef.current.pan },
    };
    pointerRef.current = { x: event.clientX, y: event.clientY };
    document.body.classList.add('select-none', 'cursor-grabbing');
  }, []);

  const handleCardPointerDown = useCallback(
    (tableName: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      interactionRef.current = {
        mode: 'drag',
        tableName,
        startPointer: { x: event.clientX, y: event.clientY },
        startPosition: getResolvedPosition(tableName),
      };
      pointerRef.current = { x: event.clientX, y: event.clientY };
      document.body.classList.add('select-none', 'cursor-grabbing');
    },
    [getResolvedPosition],
  );

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/20 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database size={14} className="text-primary" />
            <span className="truncate">{scopeLabel}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            <span>{tables.length} tables</span>
            <span className="text-border">/</span>
            <span>{canvasZoom.toFixed(2)}x zoom</span>
            {connection?.type === 'postgres' && (
              <>
                <span className="text-border">/</span>
                <span>{tab?.schemaName?.trim() || 'all schemas'}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-border/60 bg-background/60 px-2 text-xs"
            onClick={() => adjustZoom(-0.1)}
          >
            <Minus size={12} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-border/60 bg-background/60 px-2 text-xs"
            onClick={() => adjustZoom(0.1)}
          >
            <Plus size={12} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-border/60 bg-background/60 px-2 text-xs"
            onClick={resetCanvasView}
          >
            <RotateCcw size={12} />
            Reset View
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-5 border-b border-border/60 bg-card px-4 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Key size={11} className="text-primary" />
          Primary key
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Hash size={11} />
          Identity
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Fingerprint size={11} />
          Unique
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Diamond size={11} />
          Nullable
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ConstraintDot filled />
          Non-nullable
        </span>
      </div>

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

      <div
        ref={viewportRef}
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden select-none',
          loading ? 'cursor-progress' : 'cursor-grab',
        )}
        onPointerDown={handleCanvasPointerDown}
        onWheel={handleViewportWheel}
        style={{ touchAction: 'none' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: 'var(--bg-primary)',
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--border-primary) 48%, transparent) 1.1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-sm border border-border/70 bg-card px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground shadow-lg shadow-black/10">
          <Move size={12} className="text-primary" />
          Drag cards and pan canvas
        </div>

        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-sm border border-border/70 bg-secondary/50 px-4 py-3 text-sm text-foreground">
              <Loader2 size={16} className="animate-spin text-primary" />
              Loading schema visualization...
            </div>
          </div>
        )}

        {!loading && !error && tables.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="rounded-sm border border-border/70 bg-background/80 px-5 py-4 text-center">
              <div className="text-sm font-medium text-foreground">No tables available</div>
              <div className="mt-1 text-xs text-muted-foreground">
                This scope does not contain any tables to visualize.
              </div>
            </div>
          </div>
        )}

        <div
          ref={canvasRef}
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
            width: '2400px',
            height: '2400px',
            willChange: 'transform',
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width="2400"
            height="2400"
          >
            {relationships.map((relationship) => (
              <path
                key={relationship.key}
                ref={(node) => {
                  relationshipRefs.current[relationship.key] = node;
                }}
                className="schema-relationship-path"
                d={buildRelationshipPath(relationship)}
                fill="none"
                stroke="var(--border-primary)"
                strokeWidth="1.5"
                strokeDasharray="8 8"
                opacity="0.85"
              />
            ))}
          </svg>

          {tables.map((table) => {
            const position =
              viewRef.current.positionsByTable[table.qualifiedName] ??
              defaultPositions[table.qualifiedName] ?? { x: 0, y: 0 };
            const splitName = splitQualifiedTableName(table.qualifiedName);

            return (
              <div
                key={table.qualifiedName}
                ref={(node) => {
                  cardRefs.current[table.qualifiedName] = node;
                }}
                className="absolute w-[280px] select-none overflow-hidden rounded-sm border border-border/70 bg-card shadow-lg shadow-black/10"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  willChange: 'transform',
                }}
                onPointerDown={(event) => handleCardPointerDown(table.qualifiedName, event)}
                onDragStart={(event) => event.preventDefault()}
              >
                <div className="flex items-center justify-between border-b border-border/70 bg-secondary px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Database size={13} className="text-muted-foreground" />
                      <span className="truncate text-sm font-semibold text-foreground">
                        {splitName.name}
                      </span>
                    </div>
                    {table.schemaName && connection?.type === 'postgres' && (
                      <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                        {table.schemaName}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                    {table.columns.length} cols
                  </div>
                </div>

                <div className="divide-y divide-border/60 bg-card">
                  {table.columns.map((column, columnIndex) => (
                    <div
                      key={`${table.qualifiedName}:${column.name}`}
                      ref={(node) => {
                        rowRefs.current[`${table.qualifiedName}:${columnIndex}`] = node;
                      }}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {column.isPrimaryKey ? (
                          <Key size={11} className="text-primary" />
                        ) : column.isForeignKey ? (
                          <Link2 size={11} className="text-accent-secondary" />
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex items-center justify-center',
                            column.isNullable ? 'text-muted-foreground/70' : 'text-foreground/70',
                          )}
                        >
                          <ConstraintDot filled={!column.isNullable} />
                        </span>
                        {column.isIdentity ? (
                          <Hash size={11} className="opacity-70" />
                        ) : null}
                        {column.isUnique && !column.isPrimaryKey ? (
                          <Fingerprint size={11} className="opacity-70" />
                        ) : null}
                      </div>
                      <div className="min-w-0 truncate font-medium text-foreground">
                        {column.name}
                      </div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {column.typeLabel}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

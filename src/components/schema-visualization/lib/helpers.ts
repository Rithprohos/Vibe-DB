import { getTableStructure, listTables } from '@/lib/db';
import {
  getQualifiedTableName,
  getSchemaName,
  splitQualifiedTableName,
} from '@/lib/databaseObjects';
import { isSchemaFlagDisabled, isSchemaFlagEnabled } from '@/lib/schemaFlags';
import { formatColumnTypeDisplay } from '@/lib/typeDisplay';
import type { AppState, TableInfo, VisualizationPoint } from '@/store/useAppStore';

import {
  CARD_GAP_X,
  CARD_GAP_Y,
  CARD_HEADER_HEIGHT,
  CARD_ROW_HEIGHT,
  CARD_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  STRUCTURE_FETCH_BATCH_SIZE,
} from './constants';
import type {
  VisualRelationship,
  VisualRelationshipGeometry,
  VisualizedTable,
} from './types';

type ConnectionType = AppState['connections'][number]['type'];

interface LoadVisualizedTablesOptions {
  connId: string;
  connectionType: ConnectionType;
  schemaName: string | null | undefined;
  sourceTable: string | null | undefined;
}

function matchesVisualizationScope(
  table: TableInfo,
  connectionType: ConnectionType,
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

export async function loadVisualizedTables({
  connId,
  connectionType,
  schemaName,
  sourceTable,
}: LoadVisualizedTablesOptions): Promise<{
  failedTables: string[];
  tables: VisualizedTable[];
}> {
  const availableTables = await listTables(connId);
  const scopedTables = sortVisualizationTables(
    availableTables.filter((table) => matchesVisualizationScope(table, connectionType, schemaName)),
    sourceTable,
  );
  const structures = await fetchStructuresInBatches(scopedTables, connId);
  const failedTables: string[] = [];
  const tables: VisualizedTable[] = [];

  structures.forEach((result, index) => {
    const table = scopedTables[index];
    const qualifiedName = getQualifiedTableName(table);

    if (result.status === 'rejected') {
      failedTables.push(qualifiedName);
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

    tables.push({
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

  return { failedTables, tables };
}

export function buildRelationships(tables: VisualizedTable[]): VisualRelationship[] {
  const tableByQualifiedName = new Map(tables.map((table) => [table.qualifiedName, table]));
  const qualifiedNamesByTableName = new Map<string, string[]>();

  tables.forEach((table) => {
    const matches = qualifiedNamesByTableName.get(table.tableName) ?? [];
    matches.push(table.qualifiedName);
    qualifiedNamesByTableName.set(table.tableName, matches);
  });

  const resolveTargetTable = (
    sourceTable: VisualizedTable,
    targetTableName: string,
  ): string | null => {
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
}

export function buildDefaultPositions(
  tables: VisualizedTable[],
): Record<string, VisualizationPoint> {
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

export function resolveTablePosition(
  positionsByTable: Record<string, VisualizationPoint>,
  defaultPositions: Record<string, VisualizationPoint>,
  tableName: string,
): VisualizationPoint {
  return positionsByTable[tableName] ?? defaultPositions[tableName] ?? { x: 0, y: 0 };
}

export function getRelationshipRowKey(tableName: string, columnIndex: number): string {
  return `${tableName}:${columnIndex}`;
}

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));
}

function buildRelationshipGeometryFromAnchors(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): VisualRelationshipGeometry {
  const horizontalGap = Math.max(Math.abs(targetX - sourceX) / 2, 40);
  const midX = sourceX <= targetX ? sourceX + horizontalGap : sourceX - horizontalGap;

  return {
    path: `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`,
    sourcePoint: { x: sourceX, y: sourceY },
    targetPoint: { x: targetX, y: targetY },
  };
}

export function buildRelationshipFallbackGeometry(
  relationship: VisualRelationship,
  getResolvedPosition: (tableName: string) => VisualizationPoint,
): VisualRelationshipGeometry {
  const sourcePosition = getResolvedPosition(relationship.sourceTableName);
  const targetPosition = getResolvedPosition(relationship.targetTableName);
  const sourceCenterX = sourcePosition.x + CARD_WIDTH / 2;
  const targetCenterX = targetPosition.x + CARD_WIDTH / 2;
  const sourceOnLeft = sourceCenterX <= targetCenterX;
  const sourceX = sourcePosition.x + (sourceOnLeft ? CARD_WIDTH : 0);
  const targetX = targetPosition.x + (sourceOnLeft ? 0 : CARD_WIDTH);
  const sourceY =
    sourcePosition.y +
    CARD_HEADER_HEIGHT +
    relationship.sourceColumnIndex * CARD_ROW_HEIGHT +
    CARD_ROW_HEIGHT / 2;
  const targetY =
    targetPosition.y +
    CARD_HEADER_HEIGHT +
    relationship.targetColumnIndex * CARD_ROW_HEIGHT +
    CARD_ROW_HEIGHT / 2;

  return buildRelationshipGeometryFromAnchors(sourceX, sourceY, targetX, targetY);
}

export function measureRelationshipGeometry(
  relationship: VisualRelationship,
  getResolvedPosition: (tableName: string) => VisualizationPoint,
  zoom: number,
  canvasElement: HTMLDivElement | null,
  rowElements: Record<string, HTMLDivElement | null>,
): VisualRelationshipGeometry {
  const fallbackGeometry = buildRelationshipFallbackGeometry(relationship, getResolvedPosition);
  if (!canvasElement) {
    return fallbackGeometry;
  }

  const sourceRowElement = rowElements[
    getRelationshipRowKey(relationship.sourceTableName, relationship.sourceColumnIndex)
  ];
  const targetRowElement = rowElements[
    getRelationshipRowKey(relationship.targetTableName, relationship.targetColumnIndex)
  ];
  const sourceRowRect = sourceRowElement?.getBoundingClientRect();
  const targetRowRect = targetRowElement?.getBoundingClientRect();
  if (!sourceRowRect || !targetRowRect) {
    return fallbackGeometry;
  }

  const canvasRect = canvasElement.getBoundingClientRect();
  const resolvedZoom = zoom || 1;
  const sourceY =
    (sourceRowRect.top + sourceRowRect.height / 2 - canvasRect.top) / resolvedZoom;
  const targetY =
    (targetRowRect.top + targetRowRect.height / 2 - canvasRect.top) / resolvedZoom;

  return buildRelationshipGeometryFromAnchors(
    fallbackGeometry.sourcePoint.x,
    sourceY,
    fallbackGeometry.targetPoint.x,
    targetY,
  );
}

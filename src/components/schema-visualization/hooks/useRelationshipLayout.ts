import { useCallback, useLayoutEffect, useRef, type MutableRefObject } from 'react';

import type { VisualizationPoint } from '@/store/useAppStore';

import {
  buildRelationshipFallbackGeometry,
  measureRelationshipGeometry,
  resolveTablePosition,
} from '../lib/helpers';
import type {
  RelationshipEndpointNodes,
  VisualRelationship,
  VisualizedTable,
  VisualizationViewState,
} from '../lib/types';

interface UseRelationshipLayoutOptions {
  defaultPositions: Record<string, VisualizationPoint>;
  persistedPositionsByTable: Record<string, VisualizationPoint> | undefined;
  relationships: VisualRelationship[];
  tables: VisualizedTable[];
  viewRef: MutableRefObject<VisualizationViewState>;
}

export function useRelationshipLayout({
  defaultPositions,
  persistedPositionsByTable,
  relationships,
  tables,
  viewRef,
}: UseRelationshipLayoutOptions) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const relationshipRefs = useRef<Record<string, SVGPathElement | null>>({});
  const relationshipGlowRefs = useRef<Record<string, SVGPathElement | null>>({});
  const relationshipEndpointRefs = useRef<Record<string, RelationshipEndpointNodes>>({});
  const defaultPositionsRef = useRef<Record<string, VisualizationPoint>>({});
  const persistedPositionsRef = useRef<Record<string, VisualizationPoint>>({});

  const applyCardTransform = useCallback((tableName: string, position: VisualizationPoint) => {
    const node = cardRefs.current[tableName];
    if (!node) {
      return;
    }

    node.style.transform = `translate(${position.x}px, ${position.y}px)`;
  }, []);

  const getResolvedPosition = useCallback((tableName: string): VisualizationPoint => {
    return resolveTablePosition(
      viewRef.current.positionsByTable,
      defaultPositionsRef.current,
      tableName,
    );
  }, [viewRef]);

  const getFallbackRelationshipGeometry = useCallback(
    (relationship: VisualRelationship) =>
      buildRelationshipFallbackGeometry(relationship, getResolvedPosition),
    [getResolvedPosition],
  );

  const getMeasuredRelationshipGeometry = useCallback(
    (relationship: VisualRelationship) =>
      measureRelationshipGeometry(
        relationship,
        getResolvedPosition,
        viewRef.current.zoom,
        canvasRef.current,
        rowRefs.current,
      ),
    [getResolvedPosition, viewRef],
  );

  const applyRelationshipPath = useCallback(
    (relationship: VisualRelationship) => {
      const geometry = getMeasuredRelationshipGeometry(relationship);
      const pathNode = relationshipRefs.current[relationship.key];
      if (pathNode) {
        pathNode.setAttribute('d', geometry.path);
      }

      const glowNode = relationshipGlowRefs.current[relationship.key];
      if (glowNode) {
        glowNode.setAttribute('d', geometry.path);
      }

      const endpointNodes = relationshipEndpointRefs.current[relationship.key];
      if (endpointNodes?.source) {
        endpointNodes.source.setAttribute('cx', geometry.sourcePoint.x.toString());
        endpointNodes.source.setAttribute('cy', geometry.sourcePoint.y.toString());
      }
      if (endpointNodes?.target) {
        endpointNodes.target.setAttribute('cx', geometry.targetPoint.x.toString());
        endpointNodes.target.setAttribute('cy', geometry.targetPoint.y.toString());
      }
    },
    [getMeasuredRelationshipGeometry],
  );

  const applyRelationshipPathsForTable = useCallback(
    (tableName: string) => {
      relationships.forEach((relationship) => {
        if (
          relationship.sourceTableName === tableName ||
          relationship.targetTableName === tableName
        ) {
          applyRelationshipPath(relationship);
        }
      });
    },
    [applyRelationshipPath, relationships],
  );

  const applyAllRelationshipPaths = useCallback(() => {
    relationships.forEach((relationship) => {
      applyRelationshipPath(relationship);
    });
  }, [applyRelationshipPath, relationships]);

  const setCardRef = useCallback((tableName: string, node: HTMLDivElement | null) => {
    cardRefs.current[tableName] = node;
  }, []);

  useLayoutEffect(() => {
    defaultPositionsRef.current = defaultPositions;
  }, [defaultPositions]);

  useLayoutEffect(() => {
    const nextPersistedPositions = persistedPositionsByTable ?? {};
    const previousPersistedPositions = persistedPositionsRef.current;

    Object.keys(previousPersistedPositions).forEach((tableName) => {
      if (tableName in nextPersistedPositions) {
        return;
      }

      delete viewRef.current.positionsByTable[tableName];
      const fallbackPosition = defaultPositionsRef.current[tableName] ?? { x: 0, y: 0 };
      applyCardTransform(tableName, fallbackPosition);
      applyRelationshipPathsForTable(tableName);
    });

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

    persistedPositionsRef.current = { ...nextPersistedPositions };
  }, [
    applyCardTransform,
    applyRelationshipPathsForTable,
    persistedPositionsByTable,
    viewRef,
  ]);

  useLayoutEffect(() => {
    tables.forEach((table) => {
      applyCardTransform(table.qualifiedName, getResolvedPosition(table.qualifiedName));
    });
    applyAllRelationshipPaths();
  }, [applyAllRelationshipPaths, applyCardTransform, getResolvedPosition, tables]);

  return {
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
  };
}

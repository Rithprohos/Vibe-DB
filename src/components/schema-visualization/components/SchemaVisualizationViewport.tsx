import { Loader2, Move } from 'lucide-react';
import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from 'react';

import { cn } from '@/lib/utils';

import { DOT_BACKGROUND, GLOW_BACKGROUND } from '../lib/constants';
import type {
  RelationshipEndpointNodes,
  VisualRelationship,
  VisualRelationshipGeometry,
  VisualizedTable,
} from '../lib/types';
import { SchemaRelationshipLayer } from './SchemaRelationshipLayer';
import { SchemaTableCard } from './SchemaTableCard';

interface SchemaVisualizationViewportProps {
  canvasPanX: number;
  canvasPanY: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  canvasZoom: number;
  connectionType: string | undefined;
  error: string;
  getCardPosition: (tableName: string) => { x: number; y: number };
  getRelationshipGeometry: (relationship: VisualRelationship) => VisualRelationshipGeometry;
  handleCanvasPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleCardPointerDown: (
    tableName: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  handleViewportWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  loading: boolean;
  relationshipEndpointRefs: React.MutableRefObject<Record<string, RelationshipEndpointNodes>>;
  relationshipGlowRefs: React.MutableRefObject<Record<string, SVGPathElement | null>>;
  relationshipRefs: React.MutableRefObject<Record<string, SVGPathElement | null>>;
  relationships: VisualRelationship[];
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  setCardRef: (tableName: string, node: HTMLDivElement | null) => void;
  tables: VisualizedTable[];
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function SchemaVisualizationViewport({
  canvasPanX,
  canvasPanY,
  canvasRef,
  canvasZoom,
  connectionType,
  error,
  getCardPosition,
  getRelationshipGeometry,
  handleCanvasPointerDown,
  handleCardPointerDown,
  handleViewportWheel,
  loading,
  relationshipEndpointRefs,
  relationshipGlowRefs,
  relationshipRefs,
  relationships,
  rowRefs,
  setCardRef,
  tables,
  viewportRef,
}: SchemaVisualizationViewportProps) {
  return (
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
        data-screenshot-role="dot-grid"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: 'var(--bg-primary)',
          backgroundImage: DOT_BACKGROUND,
          backgroundSize: '24px 24px',
        }}
      />
      <div
        data-screenshot-role="glow-layer"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background: GLOW_BACKGROUND }}
      />

      <div
        data-screenshot-exclude="true"
        className="schema-helper-chip pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-sm border border-border/70 bg-card px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground shadow-lg shadow-black/10"
      >
        <Move size={12} className="text-primary" />
        Drag cards and pan canvas
      </div>

      {loading && (
        <div
          data-screenshot-exclude="true"
          className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
        >
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
          transform: `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`,
          width: '2400px',
          height: '2400px',
          willChange: 'transform',
        }}
      >
        <SchemaRelationshipLayer
          getGeometry={getRelationshipGeometry}
          relationshipEndpointRefs={relationshipEndpointRefs}
          relationshipGlowRefs={relationshipGlowRefs}
          relationshipRefs={relationshipRefs}
          relationships={relationships}
        />

        {tables.map((table) => (
          <SchemaTableCard
            key={table.qualifiedName}
            cardRef={(node) => {
              setCardRef(table.qualifiedName, node);
            }}
            connectionType={connectionType}
            onPointerDown={(event) => handleCardPointerDown(table.qualifiedName, event)}
            position={getCardPosition(table.qualifiedName)}
            rowRefs={rowRefs}
            table={table}
          />
        ))}
      </div>
    </div>
  );
}

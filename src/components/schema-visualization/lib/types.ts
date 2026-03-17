import type { VisualizationPoint } from '@/store/useAppStore';

export interface VisualizedColumn {
  name: string;
  typeLabel: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isNullable: boolean;
  isIdentity: boolean;
}

export interface VisualizedForeignKey {
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface VisualizedTable {
  qualifiedName: string;
  tableName: string;
  schemaName: string | null;
  columns: VisualizedColumn[];
  foreignKeys: VisualizedForeignKey[];
}

export interface VisualRelationship {
  key: string;
  sourceTableName: string;
  sourceColumnIndex: number;
  targetTableName: string;
  targetColumnIndex: number;
}

export interface VisualRelationshipGeometry {
  path: string;
  sourcePoint: VisualizationPoint;
  targetPoint: VisualizationPoint;
}

export interface VisualizationViewState {
  pan: VisualizationPoint;
  positionsByTable: Record<string, VisualizationPoint>;
  zoom: number;
}

export interface ScreenshotPreview {
  id: string;
  objectUrl: string;
  pngBytes: Uint8Array;
  width: number;
  height: number;
}

export interface RelationshipEndpointNodes {
  source: SVGCircleElement | null;
  target: SVGCircleElement | null;
}

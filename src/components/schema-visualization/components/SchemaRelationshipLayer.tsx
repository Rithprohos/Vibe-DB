import type { MutableRefObject } from 'react';

import {
  RELATIONSHIP_ENDPOINT_FILL,
  RELATIONSHIP_GLOW_STROKE,
  RELATIONSHIP_PATH_STROKE,
} from '../lib/constants';
import type {
  RelationshipEndpointNodes,
  VisualRelationship,
  VisualRelationshipGeometry,
} from '../lib/types';

interface SchemaRelationshipLayerProps {
  getGeometry: (relationship: VisualRelationship) => VisualRelationshipGeometry;
  relationshipEndpointRefs: MutableRefObject<Record<string, RelationshipEndpointNodes>>;
  relationshipGlowRefs: MutableRefObject<Record<string, SVGPathElement | null>>;
  relationshipRefs: MutableRefObject<Record<string, SVGPathElement | null>>;
  relationships: VisualRelationship[];
}

export function SchemaRelationshipLayer({
  getGeometry,
  relationshipEndpointRefs,
  relationshipGlowRefs,
  relationshipRefs,
  relationships,
}: SchemaRelationshipLayerProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width="2400"
      height="2400"
    >
      {relationships.map((relationship) => {
        const geometry = getGeometry(relationship);

        return (
          <g key={relationship.key}>
            <path
              ref={(node) => {
                relationshipGlowRefs.current[relationship.key] = node;
              }}
              className="schema-relationship-path-glow"
              d={geometry.path}
              fill="none"
              stroke={RELATIONSHIP_GLOW_STROKE}
              strokeWidth="6"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.24"
            />
            <path
              ref={(node) => {
                relationshipRefs.current[relationship.key] = node;
              }}
              className="schema-relationship-path"
              d={geometry.path}
              fill="none"
              stroke={RELATIONSHIP_PATH_STROKE}
              strokeWidth="2.25"
              strokeDasharray="9 7"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.97"
            />
            <circle
              ref={(node) => {
                relationshipEndpointRefs.current[relationship.key] = {
                  ...(relationshipEndpointRefs.current[relationship.key] ?? {
                    source: null,
                    target: null,
                  }),
                  source: node,
                };
              }}
              data-screenshot-role="relationship-source"
              cx={geometry.sourcePoint.x}
              cy={geometry.sourcePoint.y}
              r="3.25"
              fill="var(--primary)"
              stroke="var(--bg-primary)"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
              opacity="0.95"
            />
            <circle
              ref={(node) => {
                relationshipEndpointRefs.current[relationship.key] = {
                  ...(relationshipEndpointRefs.current[relationship.key] ?? {
                    source: null,
                    target: null,
                  }),
                  target: node,
                };
              }}
              data-screenshot-role="relationship-target"
              cx={geometry.targetPoint.x}
              cy={geometry.targetPoint.y}
              r="2.75"
              fill={RELATIONSHIP_ENDPOINT_FILL}
              stroke="var(--bg-primary)"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
              opacity="0.9"
            />
          </g>
        );
      })}
    </svg>
  );
}

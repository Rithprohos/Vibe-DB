import { startTransition, useEffect, useMemo, useState } from 'react';

import type { AppState } from '@/store/useAppStore';

import { buildRelationships, loadVisualizedTables } from '../lib/helpers';
import type { VisualRelationship, VisualizedTable } from '../lib/types';

interface UseVisualizedTablesOptions {
  connId: string | null;
  connectionType: AppState['connections'][number]['type'] | null | undefined;
  schemaName: string | null | undefined;
  sourceTable: string | null | undefined;
}

interface UseVisualizedTablesResult {
  error: string;
  failedTables: string[];
  loading: boolean;
  relationships: VisualRelationship[];
  tables: VisualizedTable[];
}

export function useVisualizedTables({
  connId,
  connectionType,
  schemaName,
  sourceTable,
}: UseVisualizedTablesOptions): UseVisualizedTablesResult {
  const [tables, setTables] = useState<VisualizedTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedTables, setFailedTables] = useState<string[]>([]);

  useEffect(() => {
    if (!connId || !connectionType) {
      setTables([]);
      setLoading(false);
      setError('');
      setFailedTables([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setFailedTables([]);

    void (async () => {
      try {
        const nextState = await loadVisualizedTables({
          connId,
          connectionType,
          schemaName,
          sourceTable,
        });
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setTables(nextState.tables);
          setFailedTables(nextState.failedTables);
        });
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        setTables([]);
        setFailedTables([]);
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connId, connectionType, schemaName, sourceTable]);

  const relationships = useMemo(() => buildRelationships(tables), [tables]);

  return {
    error,
    failedTables,
    loading,
    relationships,
    tables,
  };
}

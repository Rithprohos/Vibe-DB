import { useEffect, useRef, useState } from 'react';
import { buildCreateTableSQL } from '../../lib/db';
import { validateTableName } from '../../lib/tableName';
import type {
  CheckConstraint,
  ColumnDef,
  ForeignKeyConstraint,
  SupportedEngine,
} from '../../lib/createTableConstants';
import {
  getInvalidColumnNameError,
  getInvalidTypeParamsErrorForEngine,
} from './validation';

interface UseCreateTableSqlPreviewInput {
  showPreview: boolean;
  tableName: string;
  columns: ColumnDef[];
  ifNotExists: boolean;
  engineType: SupportedEngine;
  foreignKeys: ForeignKeyConstraint[];
  checkConstraints: CheckConstraint[];
  liveConstraintError: string | null;
}

export function useCreateTableSqlPreview({
  showPreview,
  tableName,
  columns,
  ifNotExists,
  engineType,
  foreignKeys,
  checkConstraints,
  liveConstraintError,
}: UseCreateTableSqlPreviewInput): string {
  const [sql, setSql] = useState('');
  const sqlPreviewRequestIdRef = useRef(0);

  useEffect(() => {
    if (!showPreview) {
      setSql('');
      return;
    }

    const hasTableName = tableName.trim().length > 0;
    const hasNamedColumn = columns.some((column) => column.name.trim().length > 0);
    if (!hasTableName || !hasNamedColumn) {
      setSql('');
      return;
    }

    if (validateTableName(tableName)) {
      setSql('');
      return;
    }
    if (getInvalidColumnNameError(columns)) {
      setSql('');
      return;
    }
    if (getInvalidTypeParamsErrorForEngine(columns, engineType)) {
      setSql('');
      return;
    }
    if (liveConstraintError) {
      setSql('');
      return;
    }

    const requestId = ++sqlPreviewRequestIdRef.current;
    void (async () => {
      try {
        const generatedSql = await buildCreateTableSQL(
          tableName,
          columns,
          ifNotExists,
          engineType,
          foreignKeys,
          checkConstraints,
        );
        if (requestId !== sqlPreviewRequestIdRef.current) {
          return;
        }
        setSql(generatedSql);
      } catch {
        if (requestId !== sqlPreviewRequestIdRef.current) {
          return;
        }
        setSql('');
      }
    })();
  }, [
    showPreview,
    tableName,
    columns,
    ifNotExists,
    engineType,
    foreignKeys,
    checkConstraints,
    liveConstraintError,
  ]);

  return sql;
}

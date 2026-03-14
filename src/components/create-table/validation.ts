import { validateColumnName } from '../../lib/tableName';
import {
  buildCheckConstraintExpression,
  FK_ACTION_OPTIONS,
  isCheckConstraintOperatorSupported,
  validateConstraintIdentifier,
  validateQualifiedConstraintIdentifier,
  validateTypeParams,
  type CheckConstraint,
  type ColumnDef,
  type ForeignKeyConstraint,
  type SupportedEngine,
} from '../../lib/createTableConstants';

interface ConstraintValidationInput {
  engineType: SupportedEngine;
  foreignKeys: ForeignKeyConstraint[];
  checkConstraints: CheckConstraint[];
  namedColumnNames: Set<string>;
}

export function getLiveColumnNameErrors(columns: ColumnDef[]): Record<string, string> {
  const errorMap: Record<string, string> = {};
  for (const column of columns) {
    if (!column.name.trim()) {
      continue;
    }
    const maybeError = validateColumnName(column.name);
    if (maybeError) {
      errorMap[column.id] = maybeError;
    }
  }
  return errorMap;
}

export function getInvalidColumnNameError(columns: ColumnDef[]): string | null {
  for (const column of columns) {
    if (!column.name.trim()) {
      continue;
    }
    const maybeError = validateColumnName(column.name);
    if (maybeError) {
      return maybeError;
    }
  }
  return null;
}

export function getInvalidTypeParamsError(columns: ColumnDef[]): string | null {
  for (const column of columns) {
    const maybeError = validateTypeParams(column.type, column.typeParams);
    if (maybeError) {
      return maybeError;
    }
  }
  return null;
}

export function getLiveConstraintError({
  engineType,
  foreignKeys,
  checkConstraints,
  namedColumnNames,
}: ConstraintValidationInput): string | null {
  for (let index = 0; index < foreignKeys.length; index += 1) {
    const fk = foreignKeys[index];
    const columnName = fk.columnName.trim();
    const referencedTable = fk.referencedTable.trim();
    const referencedColumn = fk.referencedColumn.trim();
    const hasAnyValue =
      columnName.length > 0 ||
      referencedTable.length > 0 ||
      referencedColumn.length > 0 ||
      Boolean(fk.onDelete) ||
      Boolean(fk.onUpdate);

    if (!hasAnyValue) {
      continue;
    }

    if (!columnName || !referencedTable || !referencedColumn) {
      return `Foreign key #${index + 1} requires column, referenced table, and referenced column`;
    }

    if (!namedColumnNames.has(columnName)) {
      return `Foreign key #${index + 1} references unknown local column "${columnName}"`;
    }

    const referencedTableError = engineType === 'postgres'
      ? validateQualifiedConstraintIdentifier(
          referencedTable,
          'Referenced table name',
        )
      : validateConstraintIdentifier(
          referencedTable,
          'Referenced table name',
        );
    if (referencedTableError) {
      return `Foreign key #${index + 1}: ${referencedTableError}`;
    }

    const referencedColumnError = validateConstraintIdentifier(
      referencedColumn,
      'Referenced column name',
    );
    if (referencedColumnError) {
      return `Foreign key #${index + 1}: ${referencedColumnError}`;
    }

    if (fk.onDelete && !FK_ACTION_OPTIONS.some((option) => option.value === fk.onDelete)) {
      return `Foreign key #${index + 1} has an invalid ON DELETE action`;
    }
    if (fk.onUpdate && !FK_ACTION_OPTIONS.some((option) => option.value === fk.onUpdate)) {
      return `Foreign key #${index + 1} has an invalid ON UPDATE action`;
    }
  }

  for (let index = 0; index < checkConstraints.length; index += 1) {
    const constraint = checkConstraints[index];
    const name = constraint.name.trim();
    const expression = buildCheckConstraintExpression(constraint, engineType);
    const hasBuilderValue =
      constraint.field.trim().length > 0 ||
      constraint.compareField.trim().length > 0 ||
      constraint.value.trim().length > 0 ||
      constraint.mode === 'custom';
    const hasAnyValue = name.length > 0 || expression.length > 0 || hasBuilderValue;

    if (!hasAnyValue) {
      continue;
    }

    if (
      constraint.mode === 'builder' &&
      !isCheckConstraintOperatorSupported(constraint.operator, engineType)
    ) {
      return `Check constraint #${index + 1}: regex is only supported for PostgreSQL in builder mode`;
    }

    if (!expression) {
      return constraint.mode === 'custom'
        ? `Check constraint #${index + 1} expression is required`
        : `Check constraint #${index + 1} requires a target, expression type, and input`;
    }

    if (name) {
      const nameError = validateConstraintIdentifier(name, 'Check constraint name');
      if (nameError) {
        return `Check constraint #${index + 1}: ${nameError}`;
      }
    }
  }

  return null;
}

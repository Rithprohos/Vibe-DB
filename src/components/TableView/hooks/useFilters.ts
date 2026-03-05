import { useState, useCallback, useMemo } from "react";
import type { FilterCondition, ColumnInfo } from "../types";
import { BETWEEN_OPERATORS, UNARY_OPERATORS } from "../types";

export const useFilters = (
  structure: ColumnInfo[],
  setPage: (p: number) => void,
) => {
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);

  const buildWhereClause = useCallback(
    (filterList: FilterCondition[]): string | undefined => {
      const validFilters = filterList.filter((f) => {
        if (!f.field || !f.operator) return false;
        if (BETWEEN_OPERATORS.includes(f.operator))
          return !!f.value && !!f.valueTo;
        if (!UNARY_OPERATORS.includes(f.operator) && !f.value) return false;
        return true;
      });
      if (validFilters.length === 0) return undefined;

      const conditions = validFilters.map((f) => {
        if (f.operator === "IS NULL") return `"${f.field}" IS NULL`;
        if (f.operator === "IS NOT NULL") return `"${f.field}" IS NOT NULL`;
        if (f.operator === "LIKE" || f.operator === "NOT LIKE") {
          return `"${f.field}" ${f.operator} '${f.value.replace(/'/g, "''")}'`;
        }
        if (BETWEEN_OPERATORS.includes(f.operator)) {
          const colInfo = structure.find((c) => c.name === f.field);
          const colType = colInfo?.col_type.toLowerCase() || "";
          const isNum =
            colType.includes("int") ||
            colType.includes("real") ||
            colType.includes("double") ||
            colType.includes("float");
          const fromVal =
            isNum && !isNaN(Number(f.value))
              ? f.value
              : `'${f.value.replace(/'/g, "''")}'`;
          const toVal =
            isNum && !isNaN(Number(f.valueTo))
              ? f.valueTo
              : `'${f.valueTo.replace(/'/g, "''")}'`;
          return `"${f.field}" ${f.operator} ${fromVal} AND ${toVal}`;
        }
        // Check if value is numeric
        const colInfo = structure.find((c) => c.name === f.field);
        const colType = colInfo?.col_type.toLowerCase() || "";
        const isNum =
          colType.includes("int") ||
          colType.includes("real") ||
          colType.includes("double") ||
          colType.includes("float");
        const val =
          isNum && !isNaN(Number(f.value))
            ? f.value
            : `'${f.value.replace(/'/g, "''")}'`;
        return `"${f.field}" ${f.operator} ${val}`;
      });

      return conditions.join(" AND ");
    },
    [structure],
  );

  const whereClause = useMemo(
    () => buildWhereClause(appliedFilters),
    [appliedFilters, buildWhereClause],
  );

  const handleAddFilter = (gridCols: string[]) => {
    const defaultField = gridCols[0] || "";
    setFilters((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        field: defaultField,
        operator: "=",
        value: "",
        valueTo: "",
      },
    ]);
    if (!showFilterPanel) setShowFilterPanel(true);
  };

  const handleUpdateFilter = (
    id: string,
    updates: Partial<FilterCondition>,
  ) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    );
  };

  const handleRemoveFilter = (id: string) => {
    setFilters((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) {
        setShowFilterPanel(false);
        if (appliedFilters.length > 0) {
          setAppliedFilters([]);
          setPage(0);
        }
      }
      return next;
    });
  };

  const handleApplyFilters = () => {
    setAppliedFilters([...filters]);
    setPage(0);
  };

  const handleClearAllFilters = () => {
    setFilters([]);
    setAppliedFilters([]);
    setShowFilterPanel(false);
    setPage(0);
  };

  return {
    showFilterPanel,
    setShowFilterPanel,
    filters,
    appliedFilters,
    whereClause,
    handleAddFilter,
    handleUpdateFilter,
    handleRemoveFilter,
    handleApplyFilters,
    handleClearAllFilters,
  };
};

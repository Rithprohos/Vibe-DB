import { useState, useMemo } from "react";
import type { FilterCondition } from "../types";
import { BETWEEN_OPERATORS, UNARY_OPERATORS } from "../types";

export const useFilters = (setPage: (p: number) => void) => {
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);
  const activeFilterCount = useMemo(
    () =>
      appliedFilters.filter((f) => {
        if (!f.field || !f.operator) return false;
        if (BETWEEN_OPERATORS.includes(f.operator)) {
          return !!f.value && !!f.valueTo;
        }
        if (UNARY_OPERATORS.includes(f.operator)) {
          return true;
        }
        return !!f.value;
      }).length,
    [appliedFilters],
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
    activeFilterCount,
    handleAddFilter,
    handleUpdateFilter,
    handleRemoveFilter,
    handleApplyFilters,
    handleClearAllFilters,
  };
};

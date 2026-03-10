import { useState, useMemo, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { FilterCondition } from "../types";
import { BETWEEN_OPERATORS, UNARY_OPERATORS } from "../types";

export const useFilters = (tabId: string, setPage: (p: number) => void) => {
  const updateTableViewState = useAppStore((state) => state.updateTableViewState);
  const cachedState = useMemo(
    () => useAppStore.getState().tableViewStateByTabId[tabId],
    [tabId],
  );
  const [showFilterPanel, setShowFilterPanel] = useState(
    () => cachedState?.showFilterPanel ?? false,
  );
  const [filters, setFilters] = useState<FilterCondition[]>(
    () => cachedState?.filters ?? [],
  );
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>(
    () => cachedState?.appliedFilters ?? [],
  );
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

  useEffect(() => {
    updateTableViewState(tabId, {
      showFilterPanel,
      filters,
      appliedFilters,
    });
  }, [tabId, showFilterPanel, filters, appliedFilters, updateTableViewState]);

  const handleAddFilter = useCallback((gridCols: string[]) => {
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
  }, [showFilterPanel]);

  const handleUpdateFilter = useCallback((
    id: string,
    updates: Partial<FilterCondition>,
  ) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    );
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
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
  }, [appliedFilters.length, setPage]);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters([...filters]);
    setPage(0);
  }, [filters, setPage]);

  const handleClearAllFilters = useCallback(() => {
    setFilters([]);
    setAppliedFilters([]);
    setShowFilterPanel(false);
    setPage(0);
  }, [setPage]);

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

import type { ColumnInfo } from "../../store/useAppStore";

export type { ColumnInfo };

export interface TableViewProps {
  tableName: string;
  tabId: string;
}

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  valueTo: string;
}

export interface CellInputProps {
  initialValue: string;
  onValueChange: (val: string) => void;
  onSave: (val: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  inputType?: "text" | "date";
}

export const OPERATORS = [
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "LIKE", label: "LIKE" },
  { value: "NOT LIKE", label: "NOT LIKE" },
  { value: "BETWEEN", label: "BETWEEN" },
  { value: "NOT BETWEEN", label: "NOT BETWEEN" },
  { value: "IS NULL", label: "IS NULL" },
  { value: "IS NOT NULL", label: "IS NOT NULL" },
];

export const UNARY_OPERATORS = ["IS NULL", "IS NOT NULL"];
export const BETWEEN_OPERATORS = ["BETWEEN", "NOT BETWEEN"];

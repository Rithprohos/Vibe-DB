export interface SelectedCell {
  rowIndex: number;
  columnIndex: number;
}

export interface EditorViewLike {
  state: {
    selection: {
      main: {
        empty: boolean;
        from: number;
        to: number;
      };
    };
    sliceDoc: (from: number, to: number) => string;
  };
}

export function isEditorViewLike(value: unknown): value is EditorViewLike {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<EditorViewLike>;
  const state = candidate.state;
  const main = state?.selection?.main;

  return Boolean(
    state &&
    typeof state.sliceDoc === 'function' &&
    main &&
    typeof main.empty === 'boolean' &&
    typeof main.from === 'number' &&
    typeof main.to === 'number'
  );
}

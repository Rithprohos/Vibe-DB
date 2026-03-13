export function isSchemaFlagEnabled(value: boolean | number): boolean {
  return value === true || value === 1;
}

export function isSchemaFlagDisabled(value: boolean | number): boolean {
  return !isSchemaFlagEnabled(value);
}

export function formatColumnTypeDisplay(columnType: string | null | undefined): string {
  const rawType = columnType?.trim();
  if (!rawType) {
    return '—';
  }

  const enumMatch = rawType.match(/^enum\((.+)\)$/i);
  if (enumMatch) {
    return `ENUM(${enumMatch[1]})`;
  }

  const varcharMatch = rawType.match(/^character varying(\(\d+\))?$/i);
  if (varcharMatch) {
    return `VARCHAR${varcharMatch[1] ?? ''}`;
  }

  const charMatch = rawType.match(/^character(\(\d+\))?$/i);
  if (charMatch) {
    return `CHAR${charMatch[1] ?? ''}`;
  }

  const bpcharMatch = rawType.match(/^bpchar(\(\d+\))?$/i);
  if (bpcharMatch) {
    return `CHAR${bpcharMatch[1] ?? ''}`;
  }

  const timestampWithoutZoneMatch = rawType.match(
    /^timestamp(\(\d+\))?\s+without\s+time\s+zone$/i,
  );
  if (timestampWithoutZoneMatch) {
    return `TIMESTAMP${timestampWithoutZoneMatch[1] ?? ''}`;
  }

  const timestampWithZoneMatch = rawType.match(
    /^timestamp(\(\d+\))?\s+with\s+time\s+zone$/i,
  );
  if (timestampWithZoneMatch) {
    return `TIMESTAMPTZ${timestampWithZoneMatch[1] ?? ''}`;
  }

  const timeWithoutZoneMatch = rawType.match(/^time(\(\d+\))?\s+without\s+time\s+zone$/i);
  if (timeWithoutZoneMatch) {
    return `TIME${timeWithoutZoneMatch[1] ?? ''}`;
  }

  const timeWithZoneMatch = rawType.match(/^time(\(\d+\))?\s+with\s+time\s+zone$/i);
  if (timeWithZoneMatch) {
    return `TIMETZ${timeWithZoneMatch[1] ?? ''}`;
  }

  return rawType.toUpperCase();
}

import React from 'react';

/** Token types for SQL syntax highlighting */
type TokenType = 'keyword' | 'string' | 'number' | 'identifier' | 'paren' | 'punctuation';

interface Token {
  type: TokenType;
  start: number;
  end: number;
  text: string;
}

/** Color classes for each token type */
const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: 'text-purple-400 font-semibold',
  string: 'text-emerald-400',
  number: 'text-amber-400',
  identifier: 'text-sky-400',
  paren: 'text-yellow-300',
  punctuation: 'text-muted-foreground',
} as const;

/** Regex patterns for SQL tokenization — order matters for overlap resolution */
const TOKEN_PATTERNS: { regex: RegExp; type: TokenType }[] = [
  { regex: /'[^']*'/g, type: 'string' },
  { regex: /"[^"]*"/g, type: 'identifier' },
  { regex: /\b\d+(\.\d+)?\b/g, type: 'number' },
  {
    regex:
      /\b(CREATE|TABLE|IF|NOT|EXISTS|PRIMARY|KEY|AUTOINCREMENT|NULL|UNIQUE|DEFAULT|INSERT|INTO|VALUES|SELECT|FROM|WHERE|AND|OR|DROP|ALTER|ADD|COLUMN|INDEX|INTEGER|TEXT|REAL|BLOB|NUMERIC|BOOLEAN|DATETIME|VARCHAR|FLOAT|DOUBLE|BIGINT|CHAR|DECIMAL|DATE|TIMESTAMP|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|CHECK|FOREIGN|REFERENCES|CASCADE|SET|UPDATE|DELETE|CONSTRAINT|ASC|DESC|ORDER|BY|LIMIT|OFFSET|GROUP|HAVING|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|IN|BETWEEN|LIKE|IS|GLOB|REPLACE|ABORT|FAIL|IGNORE|ROLLBACK|BEGIN|COMMIT|TRANSACTION|END|TRIGGER|VIEW|TEMP|TEMPORARY|RENAME|TO|VACUUM|REINDEX|ANALYZE|ATTACH|DETACH|EXPLAIN|PLAN|QUERY|PRAGMA|WITH|RECURSIVE|UNION|ALL|INTERSECT|EXCEPT|CASE|WHEN|THEN|ELSE|CAST|COLLATE|NATURAL|CROSS|USING|OVER|PARTITION|WINDOW|FILTER|ROWS|RANGE|GROUPS|UNBOUNDED|PRECEDING|FOLLOWING|CURRENT|ROW|EXCLUDE|TIES|NO|ACTION|DEFERRED|IMMEDIATE|INITIALLY|RESTRICT|RELEASE|SAVEPOINT|CONFLICT|DO|NOTHING|RETURNING|GENERATED|ALWAYS|STORED|VIRTUAL|MATERIALIZED)\b/gi,
    type: 'keyword',
  },
  { regex: /[()]/g, type: 'paren' },
  { regex: /[,;]/g, type: 'punctuation' },
];

/**
 * Lightweight SQL syntax highlighter.
 * Tokenizes SQL and wraps tokens in colored <span> elements.
 * Suitable for read-only code previews — no external dependencies.
 */
export function highlightSQL(query: string): React.ReactNode[] {
  // Collect all tokens
  const tokens: Token[] = [];

  for (const { regex, type } of TOKEN_PATTERNS) {
    const r = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(query)) !== null) {
      tokens.push({
        type,
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
      });
    }
  }

  // Sort by position; for overlaps, longer tokens win
  tokens.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping tokens (keep first/longest at each position)
  const filtered: Token[] = [];
  let lastEnd = 0;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      filtered.push(t);
      lastEnd = t.end;
    }
  }

  // Build React nodes
  const result: React.ReactNode[] = [];
  let pos = 0;

  for (const t of filtered) {
    if (t.start > pos) {
      result.push(query.slice(pos, t.start));
    }
    result.push(
      <span key={t.start} className={TOKEN_COLORS[t.type]}>
        {t.text}
      </span>,
    );
    pos = t.end;
  }

  if (pos < query.length) {
    result.push(query.slice(pos));
  }

  return result;
}

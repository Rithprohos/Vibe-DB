import type { Connection } from '@/store/useAppStore';

export type QueryExecutionSurface = 'query-editor' | 'guided';
export type GuidedMutationKind = 'delete-rows' | 'truncate-table' | 'drop-table';
export type ConnectionTag = Connection['tag'];

const BLOCKED_IN_QUERY_EDITOR = new Set(['DROP', 'TRUNCATE']);
const CONFIRM_REQUIRED_IN_QUERY_EDITOR = new Set([
  'ALTER',
  'CREATE',
  'DELETE',
  'INSERT',
  'REPLACE',
  'UPDATE',
]);
const SCHEMA_REFRESH_STATEMENTS = new Set(['ALTER', 'CREATE', 'DROP']);

export interface QueryStatementAnalysis {
  keyword: string;
}

export interface QueryExecutionPolicy {
  statements: QueryStatementAnalysis[];
  blockedStatements: string[];
  confirmStatements: string[];
  requiresConfirmation: boolean;
  shouldRefreshSchema: boolean;
}

export interface GuidedMutationPolicy {
  requiresConfirmation: boolean;
  title: string;
  description: string;
  warning: string;
}

export function analyzeQueryExecutionPolicy(
  query: string,
  options: {
    connectionTag?: ConnectionTag;
    surface: QueryExecutionSurface;
  },
): QueryExecutionPolicy {
  const statements = splitSqlStatements(query)
    .map((sql) => {
      const keyword = getLeadingKeyword(sql);
      return keyword ? { keyword } : null;
    })
    .filter((statement): statement is QueryStatementAnalysis => statement !== null);

  const shouldRefreshSchema = statements.some(({ keyword }) =>
    SCHEMA_REFRESH_STATEMENTS.has(keyword),
  );

  if (options.connectionTag !== 'production' || options.surface !== 'query-editor') {
    return {
      statements,
      blockedStatements: [],
      confirmStatements: [],
      requiresConfirmation: false,
      shouldRefreshSchema,
    };
  }

  const blockedStatements = dedupeStatements(
    statements
      .filter(({ keyword }) => BLOCKED_IN_QUERY_EDITOR.has(keyword))
      .map(({ keyword }) => keyword),
  );
  const confirmStatements = dedupeStatements(
    statements
      .filter(({ keyword }) => CONFIRM_REQUIRED_IN_QUERY_EDITOR.has(keyword))
      .map(({ keyword }) => keyword),
  );

  return {
    statements,
    blockedStatements,
    confirmStatements,
    requiresConfirmation: blockedStatements.length === 0 && confirmStatements.length > 0,
    shouldRefreshSchema,
  };
}

export function getGuidedMutationPolicy(
  connectionTag: ConnectionTag,
  mutationKind: GuidedMutationKind,
): GuidedMutationPolicy {
  const defaultPolicy = {
    requiresConfirmation: false,
  };

  if (mutationKind === 'delete-rows') {
    return connectionTag === 'production'
      ? {
          ...defaultPolicy,
          requiresConfirmation: true,
          title: 'Confirm Deletion',
          description:
            'Production guardrails require confirmation before guided destructive actions.',
          warning:
            'This connection is tagged as PRODUCTION. Deleted data cannot be recovered.',
        }
      : {
          ...defaultPolicy,
          title: 'Delete Selected Rows',
          description:
            'Delete the selected rows from this table.',
          warning: 'Deleted rows cannot be recovered.',
        };
  }

  if (mutationKind === 'truncate-table') {
    return connectionTag === 'production'
      ? {
          ...defaultPolicy,
          requiresConfirmation: true,
          title: 'Truncate Table',
          description:
            'Production guardrails require confirmation before guided destructive actions.',
          warning:
            'This connection is tagged as PRODUCTION. Truncation is destructive and cannot be undone.',
        }
      : {
          ...defaultPolicy,
          title: 'Truncate Table',
          description:
            'You are about to remove every row from this table.',
          warning: 'This action cannot be undone.',
        };
  }

  // drop-table
  return connectionTag === 'production'
    ? {
        ...defaultPolicy,
        requiresConfirmation: true,
        title: 'Drop Table',
        description:
          'Production guardrails require confirmation before guided destructive actions.',
        warning:
          'This connection is tagged as PRODUCTION. Dropping a table is destructive and cannot be undone.',
      }
    : {
        ...defaultPolicy,
        title: 'Drop Table',
        description:
          'You are about to permanently delete this table and all its data.',
        warning: 'This action cannot be undone. The table and all its data will be permanently lost.',
      };
}

export function getBlockedQueryEditorMessage(blockedStatements: string[]): string {
  const blockedList = blockedStatements.join(', ');
  return `Blocked on production-tagged connection: ${blockedList} is disabled in the query editor.`;
}

export function splitSqlStatements(query: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];
    const nextChar = query[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inSingle) {
      if (char === "'") inSingle = false;
      continue;
    }

    if (inDouble) {
      if (char === '"') inDouble = false;
      continue;
    }

    if (inBacktick) {
      if (char === '`') inBacktick = false;
      continue;
    }

    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      continue;
    }

    if (char === '`') {
      inBacktick = true;
      continue;
    }

    if (char === ';') {
      const statement = query.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }

  const trailing = query.slice(start).trim();
  if (trailing) statements.push(trailing);

  return statements;
}

function getLeadingKeyword(statement: string): string | null {
  const keywords = extractStatementKeywords(statement);
  if (keywords.length === 0) return null;

  const [firstKeyword, ...remainingKeywords] = keywords;
  if (firstKeyword !== 'WITH') return firstKeyword;

  const withMutationKeyword = remainingKeywords.find((keyword) =>
    BLOCKED_IN_QUERY_EDITOR.has(keyword) || CONFIRM_REQUIRED_IN_QUERY_EDITOR.has(keyword),
  );

  return withMutationKeyword ?? firstKeyword;
}

function dedupeStatements(statements: string[]): string[] {
  return Array.from(new Set(statements));
}

function extractStatementKeywords(statement: string): string[] {
  const keywords: string[] = [];
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index];
    const nextChar = statement[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inSingle) {
      if (char === "'") inSingle = false;
      continue;
    }

    if (inDouble) {
      if (char === '"') inDouble = false;
      continue;
    }

    if (inBacktick) {
      if (char === '`') inBacktick = false;
      continue;
    }

    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      continue;
    }

    if (char === '`') {
      inBacktick = true;
      continue;
    }

    if (!isAsciiLetter(char)) {
      continue;
    }

    let end = index + 1;
    while (end < statement.length && isAsciiLetter(statement[end])) {
      end += 1;
    }

    keywords.push(statement.slice(index, end).toUpperCase());
    index = end - 1;
  }

  return keywords;
}

function isAsciiLetter(value: string): boolean {
  if (value.length !== 1) return false;
  const code = value.charCodeAt(0);
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

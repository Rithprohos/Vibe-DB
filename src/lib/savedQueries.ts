import {
  MAX_SAVED_QUERIES,
  MAX_SAVED_QUERY_NAME_LENGTH,
  MAX_SAVED_QUERY_SQL_LENGTH,
} from "@/store/constants";
import type { SavedQuery } from "@/store/types";

export interface SavedQueryInput {
  id?: string;
  name: string;
  sql: string;
  connectionId: string | null;
}

export interface ValidSavedQueryInput {
  name: string;
  sql: string;
  connectionId: string;
}

const GENERIC_QUERY_TITLE_PATTERN = /^(new query|query(?:\s+\d+)?)$/i;

export function normalizeSavedQueryName(name: string): string {
  return name.trim();
}

export function normalizeSavedQuerySql(sql: string): string {
  return sql.trim();
}

export function validateSavedQueryInput(
  savedQueries: SavedQuery[],
  input: SavedQueryInput,
): ValidSavedQueryInput {
  const name = normalizeSavedQueryName(input.name);
  const sql = normalizeSavedQuerySql(input.sql);
  const connectionId = input.connectionId?.trim() ?? "";

  if (!name) {
    throw new Error("Query name is required");
  }

  if (name.length > MAX_SAVED_QUERY_NAME_LENGTH) {
    throw new Error(
      `Query name must be ${MAX_SAVED_QUERY_NAME_LENGTH} characters or fewer`,
    );
  }

  if (!sql) {
    throw new Error("SQL is required");
  }

  if (sql.length > MAX_SAVED_QUERY_SQL_LENGTH) {
    throw new Error(
      `SQL must be ${MAX_SAVED_QUERY_SQL_LENGTH.toLocaleString()} characters or fewer`,
    );
  }

  if (!connectionId) {
    throw new Error("A saved query must belong to a connection");
  }

  const duplicate = savedQueries.find(
    (savedQuery) =>
      savedQuery.id !== input.id &&
      savedQuery.connectionId === connectionId &&
      savedQuery.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
  );

  if (duplicate) {
    throw new Error("A saved query with this name already exists");
  }

  const savedQueriesForConnection = savedQueries.filter(
    (savedQuery) => savedQuery.connectionId === connectionId,
  );

  if (!input.id && savedQueriesForConnection.length >= MAX_SAVED_QUERIES) {
    throw new Error(
      `You can save up to ${MAX_SAVED_QUERIES.toLocaleString()} queries per connection`,
    );
  }

  return {
    name,
    sql,
    connectionId,
  };
}

export function buildSavedQueryDefaultName(tabTitle?: string | null): string {
  const trimmedTitle = tabTitle?.trim();
  if (trimmedTitle && !GENERIC_QUERY_TITLE_PATTERN.test(trimmedTitle)) {
    return trimmedTitle.slice(0, MAX_SAVED_QUERY_NAME_LENGTH);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `query ${year}-${month}-${day} ${hours}:${minutes}`;
}

export function getSavedQuerySortValue(savedQuery: SavedQuery): number {
  return savedQuery.updatedAt;
}

export function getSavedQueriesForConnection(
  savedQueries: SavedQuery[],
  connectionId: string | null,
): SavedQuery[] {
  if (!connectionId) {
    return [];
  }

  return savedQueries.filter((savedQuery) => savedQuery.connectionId === connectionId);
}

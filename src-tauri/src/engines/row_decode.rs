use sqlx::postgres::PgRow;
use sqlx::sqlite::SqliteRow;
use sqlx::Row;

use super::{EngineError, EngineResult};

macro_rules! decode_i64_like {
    ($row:expr, $column:expr, [$($ty:ty),+ $(,)?]) => {{
        let row = $row;
        let column = $column;
        let mut decoded = None;

        $(
            if decoded.is_none() {
                if let Ok(value) = row.try_get::<$ty, _>(column) {
                    decoded = Some(i64::from(value));
                }
            }
        )+

        decoded.ok_or_else(|| {
            EngineError::QueryError(format!(
                "Failed to decode integer column '{column}' as an i64-compatible type"
            ))
        })
    }};
}

/// Decodes integer metadata columns from SQLite rows into `i64`.
pub(crate) fn decode_sqlite_i64(row: &SqliteRow, column: &str) -> EngineResult<i64> {
    decode_i64_like!(row, column, [i64, i32, i16, u32, u16])
}

/// Decodes integer metadata columns from PostgreSQL rows into `i64`.
pub(crate) fn decode_postgres_i64(row: &PgRow, column: &str) -> EngineResult<i64> {
    decode_i64_like!(row, column, [i64, i32, i16])
}

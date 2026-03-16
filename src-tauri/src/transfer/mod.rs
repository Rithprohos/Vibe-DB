mod csv;
mod export;
mod import;
mod json;
mod sql;

use crate::sql_helpers::FilterConditionInput;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use export::export_table_data;
pub use import::import_table_data;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TableTransferFormat {
    Csv,
    Json,
    Sql,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTableDataInput {
    pub table_name: String,
    pub format: TableTransferFormat,
    pub destination_path: String,
    #[serde(default)]
    pub filters: Vec<FilterConditionInput>,
    #[serde(default)]
    pub sort_col: Option<String>,
    #[serde(default)]
    pub sort_dir: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTableDataResult {
    pub rows_exported: usize,
    pub path: String,
    pub message: String,
    #[serde(skip_serializing)]
    pub sql: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportTableDataInput {
    pub table_name: String,
    pub format: TableTransferFormat,
    pub source_path: String,
    #[serde(default)]
    pub exclude_columns: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportTableDataResult {
    pub rows_imported: usize,
    pub message: String,
    #[serde(skip_serializing)]
    pub sql: String,
}

#[derive(Debug, Error)]
pub enum TransferError {
    #[error("{0}")]
    Validation(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("CSV error: {0}")]
    Csv(#[from] ::csv::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Query error: {0}")]
    Query(String),
}

impl TransferError {
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(message.into())
    }
}

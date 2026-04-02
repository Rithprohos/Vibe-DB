mod counts;
mod create_enum;
mod create_indexes;
mod create_table;
mod create_view;
mod filters;
mod identifiers;
mod rows;
mod values;

pub use counts::extract_count;
pub use create_enum::build_create_enum_sql;
pub use create_indexes::build_create_indexes_sql;
pub use create_table::build_create_table_sql;
pub use create_view::build_create_view_sql;
pub use filters::{FilterConditionInput, build_where_clause, normalize_order_dir};
pub use identifiers::{quote_identifier, quote_qualified_identifier, validate_identifier};
pub use rows::{
    RowDataInput, RowIdentifierInput, RowUpdateInput, build_delete_queries, build_insert_queries,
    build_update_queries,
};

#[cfg(test)]
pub use create_table::{
    CheckConstraintInput, CreateTableColumnInput, ForeignKeyConstraintInput, TypeParams,
};

#[cfg(test)]
pub use create_indexes::CreateIndexInput;

#[cfg(test)]
pub use rows::{build_insert_query, build_where_clause_for_row};

#[cfg(test)]
mod tests;

mod counts;
mod create_table;
mod create_view;
mod filters;
mod identifiers;
mod rows;
mod values;

pub use counts::extract_count;
pub use create_table::build_create_table_sql;
pub use create_view::build_create_view_sql;
pub use filters::{build_where_clause, normalize_order_dir, FilterConditionInput};
pub use identifiers::{quote_identifier, quote_qualified_identifier};
pub use rows::{
    build_delete_queries, build_insert_queries, build_update_queries, RowDataInput,
    RowIdentifierInput, RowUpdateInput,
};

#[cfg(test)]
pub use create_table::{
    CheckConstraintInput, CreateTableColumnInput, ForeignKeyConstraintInput, TypeParams,
};

#[cfg(test)]
pub use rows::{build_insert_query, build_where_clause_for_row};

#[cfg(test)]
mod tests;

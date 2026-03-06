use std::collections::HashMap;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=../.env");

    let env_file_path = Path::new("../.env");
    let mut env_file_values: HashMap<String, String> = HashMap::new();

    if env_file_path.exists() {
        if let Ok(iter) = dotenvy::from_path_iter(env_file_path) {
            for item in iter.flatten() {
                env_file_values.insert(item.0, item.1);
            }
        }
    }

    for key in [
        "VIBEDB_DEFAULT_AI_URL",
        "VIBEDB_DEFAULT_AI_API_KEY",
        "VIBEDB_DEFAULT_AI_MODEL",
    ] {
        if let Ok(value) = std::env::var(key) {
            println!("cargo:rustc-env={key}={value}");
            continue;
        }
        if let Some(value) = env_file_values.get(key) {
            println!("cargo:rustc-env={key}={value}");
        }
    }

    tauri_build::build()
}

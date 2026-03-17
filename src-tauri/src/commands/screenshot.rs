use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use tauri::image::Image;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSchemaScreenshotInput {
    pub destination_path: String,
    pub png_bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSchemaScreenshotResult {
    pub path: String,
    pub message: String,
}

#[tauri::command]
pub async fn save_schema_screenshot(
    input: SaveSchemaScreenshotInput,
) -> Result<SaveSchemaScreenshotResult, String> {
    let destination_path = input.destination_path.trim();
    if destination_path.is_empty() {
        return Err("Destination path is required".to_string());
    }
    if input.png_bytes.is_empty() {
        return Err("Screenshot bytes are required".to_string());
    }

    let destination = Path::new(destination_path);
    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to prepare destination directory: {error}"))?;
        }
    }

    fs::write(destination, &input.png_bytes)
        .map_err(|error| format!("Failed to save schema screenshot: {error}"))?;

    Ok(SaveSchemaScreenshotResult {
        path: destination_path.to_string(),
        message: "Schema screenshot saved".to_string(),
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopySchemaScreenshotInput {
    pub png_bytes: Vec<u8>,
}

/// Copies the screenshot buffer directly to the system clipboard.
#[tauri::command]
pub async fn copy_schema_screenshot(
    app: AppHandle,
    input: CopySchemaScreenshotInput,
) -> Result<(), String> {
    if input.png_bytes.is_empty() {
        return Err("Screenshot data is empty".into());
    }

    let decoded_image = image::load_from_memory_with_format(&input.png_bytes, ImageFormat::Png)
        .map_err(|error| format!("Failed to decode screenshot PNG: {error}"))?
        .into_rgba8();
    let (width, height) = decoded_image.dimensions();
    let image = Image::new_owned(decoded_image.into_raw(), width, height);

    app.clipboard()
        .write_image(&image)
        .map_err(|error| format!("Failed to copy screenshot to clipboard: {error}"))
}

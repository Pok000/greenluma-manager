use std::fs;
use std::path::{Path, PathBuf};

fn get_steam_path() -> PathBuf {
    // Default Windows Steam installation path
    PathBuf::from("C:\\Program Files (x86)\\Steam")
}

#[tauri::command]
fn enable_greenluma(source_dll_path: String) -> Result<String, String> {
    let steam_path = get_steam_path();
    let target_path = steam_path.join("user32.dll");

    if !Path::new(&source_dll_path).exists() {
        return Err(format!("Source DLL not found at: {}", source_dll_path));
    }

    match fs::copy(&source_dll_path, &target_path) {
        Ok(_) => Ok(format!("Successfully enabled GreenLuma. Copied to {:?}", target_path)),
        Err(e) => Err(format!("Failed to copy DLL to Steam directory: {}. You may need Administrator privileges.", e)),
    }
}

#[tauri::command]
fn disable_greenluma() -> Result<String, String> {
    let steam_path = get_steam_path();
    let target_path = steam_path.join("user32.dll");

    if !target_path.exists() {
        return Ok("GreenLuma is already disabled (user32.dll not found in Steam directory).".into());
    }

    match fs::remove_file(&target_path) {
        Ok(_) => Ok("Successfully disabled GreenLuma (removed user32.dll).".into()),
        Err(e) => Err(format!("Failed to remove user32.dll: {}. You may need Administrator privileges.", e)),
    }
}

#[tauri::command]
fn generate_app_list(game_ids: Vec<String>) -> Result<String, String> {
    let steam_path = get_steam_path();
    let app_list_path = steam_path.join("AppList");

    // Clean up existing AppList directory if it exists
    if app_list_path.exists() {
        if let Err(e) = fs::remove_dir_all(&app_list_path) {
            return Err(format!("Failed to clear existing AppList directory: {}", e));
        }
    }

    // Create fresh AppList directory
    if let Err(e) = fs::create_dir_all(&app_list_path) {
        return Err(format!("Failed to create AppList directory: {}", e));
    }

    // Write each game ID to a separate text file, numbered incrementally
    for (index, id) in game_ids.iter().enumerate() {
        let file_path = app_list_path.join(format!("{}.txt", index));
        if let Err(e) = fs::write(&file_path, id) {
             return Err(format!("Failed to write game ID {} to file {:?}: {}", id, file_path, e));
        }
    }

    Ok(format!("Successfully generated AppList for {} games.", game_ids.len()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![enable_greenluma, disable_greenluma, generate_app_list])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

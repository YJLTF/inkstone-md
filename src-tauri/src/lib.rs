#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    Emitter, Manager,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_open: bool,
    pub children: Option<Vec<FileEntry>>,
}

#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: &str, content: &str) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_bytes(path: &str, content: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_bytes(path: &str) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_file_info(path: &str) -> Result<FileInfo, String> {
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    Ok(FileInfo {
        name: Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("untitled")
            .to_string(),
        size: metadata.len(),
    })
}

#[derive(serde::Serialize)]
struct FileInfo {
    name: String,
    size: u64,
}

#[tauri::command]
fn read_directory(path: &str) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(path);
    if !path.is_dir() {
        return Err("Not a directory".to_string());
    }

    let mut entries = Vec::new();
    match std::fs::read_dir(path) {
        Ok(dir) => {
            for entry in dir.flatten() {
                let entry_path = entry.path();
                let name = entry_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                if name.starts_with('.') {
                    continue;
                }

                let is_dir = entry_path.is_dir();
                let path_str = entry_path.to_string_lossy().to_string();

                let children = if is_dir {
                    match read_directory(&path_str) {
                        Ok(children) => Some(children),
                        Err(_) => None,
                    }
                } else {
                    None
                };

                entries.push(FileEntry {
                    name,
                    path: path_str,
                    is_dir,
                    is_open: false,
                    children,
                });
            }
        }
        Err(e) => return Err(e.to_string()),
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
fn create_file(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if path.exists() {
        return Err("文件已存在".to_string());
    }
    std::fs::write(path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn create_directory(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if path.exists() {
        return Err("目录已存在".to_string());
    }
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_path(old_path: &str, new_path: &str) -> Result<(), String> {
    let old_path = Path::new(old_path);
    let new_path = Path::new(new_path);
    if !old_path.exists() {
        return Err("源路径不存在".to_string());
    }
    if new_path.exists() {
        return Err("目标路径已存在".to_string());
    }
    std::fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_path(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if !path.exists() {
        return Err("路径不存在".to_string());
    }
    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            write_file_bytes,
            read_file_bytes,
            get_file_info,
            read_directory,
            create_file,
            create_directory,
            rename_path,
            delete_path
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("InkStone MD").unwrap();

            let file_menu = Submenu::with_items(
                app,
                "文件",
                true,
                &[
                    &MenuItem::with_id(app, "new", "新建\tCtrl+N", true, None::<&str>)?,
                    &MenuItem::with_id(app, "open", "打开\tCtrl+O", true, None::<&str>)?,
                    &MenuItem::with_id(app, "save", "保存\tCtrl+S", true, None::<&str>)?,
                    &MenuItem::with_id(app, "saveas", "另存为\tCtrl+Shift+S", true, None::<&str>)?,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "编辑",
                true,
                &[
                    &MenuItem::with_id(app, "undo", "撤销\tCtrl+Z", true, None::<&str>)?,
                    &MenuItem::with_id(app, "redo", "重做\tCtrl+Y", true, None::<&str>)?,
                ],
            )?;

            let view_menu = Submenu::with_items(
                app,
                "视图",
                true,
                &[
                    &MenuItem::with_id(app, "sidebar", "文件树\tCtrl+B", true, None::<&str>)?,
                    &MenuItem::with_id(app, "split", "分栏视图", true, None::<&str>)?,
                    &MenuItem::with_id(app, "preview", "预览模式", true, None::<&str>)?,
                    &MenuItem::with_id(app, "dark", "深色主题", true, None::<&str>)?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu])?;

            window.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|window, event| {
            let id = event.id().as_ref();
            window.emit("menu-event", id).unwrap();
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

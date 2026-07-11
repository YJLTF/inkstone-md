#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    AppHandle, Emitter, Listener, Manager,
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

/// 递归复制目录树(src -> dst),用于跨盘符移动的回退路径。
fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_all(&path, &dest)?;
        } else {
            std::fs::copy(&path, &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 移动 src 到 dst_dir 目录下(保留文件名)。优先 rename(同盘符原子操作),
/// 失败(Windows 跨盘符)则回退为 copy + delete。
#[tauri::command]
fn move_path(src: &str, dst_dir: &str) -> Result<(), String> {
    let src = Path::new(src);
    let dst_dir = Path::new(dst_dir);
    if !src.exists() {
        return Err("源路径不存在".to_string());
    }
    if !dst_dir.is_dir() {
        return Err("目标不是目录".to_string());
    }
    let file_name = src
        .file_name()
        .ok_or_else(|| "无法获取文件名".to_string())?;
    let dst = dst_dir.join(file_name);
    if dst.exists() {
        return Err("目标已存在同名项".to_string());
    }
    if std::fs::rename(src, &dst).is_ok() {
        return Ok(());
    }
    if src.is_dir() {
        copy_dir_all(src, &dst)?;
        std::fs::remove_dir_all(src).map_err(|e| e.to_string())?;
    } else {
        std::fs::copy(src, &dst).map_err(|e| e.to_string())?;
        std::fs::remove_file(src).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 确保应用内库根目录存在:优先读 store 中的 libraryPath;
/// 为空则用 app_data_dir/InkStoneMD/library 建默认库并写回。返回库根路径。
#[tauri::command]
fn ensure_library(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    if let Some(val) = store.get("libraryPath") {
        if let Some(p) = val.as_str() {
            if Path::new(p).is_dir() {
                return Ok(p.to_string());
            }
        }
    }

    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lib = data_dir.join("InkStoneMD").join("library");
    std::fs::create_dir_all(&lib).map_err(|e| e.to_string())?;
    let lib_str = lib.to_string_lossy().to_string();
    store.set("libraryPath", serde_json::json!(lib_str));
    store.save().map_err(|e| e.to_string())?;
    Ok(lib_str)
}

/// 迁移库根到 new_path:把当前库内容搬到新目录,更新 store 的 libraryPath。
/// 目标目录必须为空或不存在。返回新库路径。
#[tauri::command]
fn migrate_library(app: AppHandle, new_path: String) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let old = store
        .get("libraryPath")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or_else(|| "未配置 libraryPath".to_string())?;
    let old_path = Path::new(&old);
    let new_p = Path::new(&new_path);

    if new_p.exists() {
        if !new_p.is_dir() {
            return Err("目标路径不是目录".to_string());
        }
        if std::fs::read_dir(new_p).map_err(|e| e.to_string())?.count() > 0 {
            return Err("目标目录非空".to_string());
        }
    } else {
        std::fs::create_dir_all(new_p).map_err(|e| e.to_string())?;
    }

    if old_path.exists() && old_path.is_dir() {
        for entry in std::fs::read_dir(old_path).map_err(|e| e.to_string())? {
            let e = entry.map_err(|e| e.to_string())?;
            let ep = e.path();
            let dst = new_p.join(e.file_name());
            if std::fs::rename(&ep, &dst).is_err() {
                if ep.is_dir() {
                    copy_dir_all(&ep, &dst)?;
                    let _ = std::fs::remove_dir_all(&ep);
                } else {
                    std::fs::copy(&ep, &dst).map_err(|e| e.to_string())?;
                    let _ = std::fs::remove_file(&ep);
                }
            }
        }
    }

    store.set("libraryPath", serde_json::json!(new_path));
    store.save().map_err(|e| e.to_string())?;
    Ok(new_path)
}

/// 在系统文件管理器中"显示"该路径。目录直接打开其内容,文件则打开所在目录并选中。
#[tauri::command]
fn reveal_in_folder(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err("路径不存在".to_string());
    }
    let is_dir = p.is_dir();
    #[cfg(target_os = "windows")]
    {
        // 目录:直接打开该目录;文件:explorer /select,<path> 聚焦到该文件
        let arg = if is_dir { path.to_string() } else { format!("/select,{}", path) };
        std::process::Command::new("explorer")
            .arg(arg)
            .spawn()
            .map_err(|e| format!("explorer 启动失败: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        if is_dir {
            std::process::Command::new("open")
                .arg(path)
                .spawn()
                .map_err(|e| format!("open 启动失败: {}", e))?;
        } else {
            std::process::Command::new("open")
                .args(["-R", path])
                .spawn()
                .map_err(|e| format!("open 启动失败: {}", e))?;
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let target = if is_dir { p } else { p.parent().unwrap_or(Path::new("/")) };
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("xdg-open 启动失败: {}", e))?;
    }
    Ok(())
}

/// 压缩图片:读取 src,按 format(jpeg/png)+ quality(仅 jpeg)重新编码到 dest。
/// 返回压缩后文件的字节数。
#[tauri::command]
fn compress_image(
    src: &str,
    dest: &str,
    format: &str,
    quality: u8,
) -> Result<u64, String> {
    use image::codecs::jpeg::JpegEncoder;
    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
    use image::{ExtendedColorType, ImageEncoder, ImageReader};
    use std::fs::File;
    use std::io::BufWriter;

    let img = ImageReader::open(src)
        .map_err(|e| format!("打开失败: {}", e))?
        .with_guessed_format()
        .map_err(|e| format!("读取格式失败: {}", e))?
        .decode()
        .map_err(|e| format!("解码失败: {}", e))?;

    if let Some(parent) = std::path::Path::new(dest).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    let file = File::create(dest).map_err(|e| format!("创建目标失败: {}", e))?;
    let mut writer = BufWriter::new(file);
    let fmt = format.to_lowercase();
    match fmt.as_str() {
        "jpeg" | "jpg" => {
            let rgb = img.to_rgb8();
            let enc = JpegEncoder::new_with_quality(&mut writer, quality);
            enc.write_image(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                ExtendedColorType::Rgb8,
            )
            .map_err(|e| format!("JPEG 编码失败: {}", e))?;
        }
        "png" => {
            let rgba = img.to_rgba8();
            let enc = PngEncoder::new_with_quality(
                &mut writer,
                CompressionType::Default,
                FilterType::Adaptive,
            );
            enc.write_image(
                rgba.as_raw(),
                rgba.width(),
                rgba.height(),
                ExtendedColorType::Rgba8,
            )
            .map_err(|e| format!("PNG 编码失败: {}", e))?;
        }
        _ => return Err(format!("不支持的格式: {}", format)),
    }
    drop(writer);
    let size = std::fs::metadata(dest).map_err(|e| e.to_string())?.len();
    Ok(size)
}

/// 启动时携带的待打开文件,挂在 App state,等前端发 `frontend-ready` 时再下发。
struct StartupFile(Option<String>);

/// 解析一组命令行参数,找到第一个存在的、扩展名匹配的 markdown / 文本文件。
fn pick_openable_path<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    for arg in args.into_iter().skip(1) {
        let a = arg.as_ref();
        if a.is_empty() {
            continue;
        }
        // 跳过明显是 flag 的项(以 "-" 开头)
        if a.starts_with('-') {
            continue;
        }
        let lower = a.to_lowercase();
        if !(lower.ends_with(".md")
            || lower.ends_with(".markdown")
            || lower.ends_with(".txt"))
        {
            continue;
        }
        if Path::new(a).exists() {
            return Some(a.to_string());
        }
    }
    None
}

/// 真正把文件路径派发给前端:聚焦主窗口后 emit `open-file`。
/// 若主窗口尚未就绪,会先尝试显示窗口。
fn dispatch_open_file(app: &AppHandle, path: String) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = app.emit("open-file", path);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 单实例插件必须放在最前面
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = pick_openable_path(argv) {
                dispatch_open_file(app, path);
            } else {
                // 没有拿到文件路径,只把窗口前置
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(StartupFile(pick_openable_path(std::env::args().collect::<Vec<_>>())))
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
            delete_path,
            reveal_in_folder,
            compress_image,
            ensure_library,
            migrate_library,
            move_path,
            frontend_ready,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("InkStone MD").unwrap();

            // 注册运行时事件:前端发出 `frontend-ready` 后,把启动时挂起的文件下发
            let app_handle = app.handle().clone();
            app.listen("frontend-ready", move |_| {
                if let Some(state) = app_handle.try_state::<StartupFile>() {
                    if let Some(path) = state.0.clone() {
                        dispatch_open_file(&app_handle, path);
                    }
                }
            });

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
                    &MenuItem::with_id(app, "edit", "编辑模式\tCtrl+\\", true, None::<&str>)?,
                    &MenuItem::with_id(app, "split", "分栏视图", true, None::<&str>)?,
                    &MenuItem::with_id(app, "preview", "预览模式", true, None::<&str>)?,
                    &MenuItem::with_id(app, "dark", "深色主题", true, None::<&str>)?,
                ],
            )?;

            let help_menu = Submenu::with_items(
                app,
                "帮助",
                true,
                &[
                    &MenuItem::with_id(app, "shortcuts", "快捷键\tF1", true, None::<&str>)?,
                    &MenuItem::with_id(app, "about", "关于 InkStone MD", true, None::<&str>)?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &help_menu])?;

            window.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|window, event| {
            let id = event.id().as_ref();
            window.emit("menu-event", id).unwrap();
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            // macOS / iOS / Android:通过 OS 打开文件的事件
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            {
                use tauri::RunEvent;
                if let RunEvent::Opened { ref urls } = _event {
                    for url in urls {
                        if let Ok(p) = url.to_file_path() {
                            if let Some(s) = p.to_str() {
                                dispatch_open_file(_app_handle, s.to_string());
                            }
                        }
                    }
                }
            }
            let _ = (_app_handle, _event);
        });
}

/// 前端通知后端"已挂载完成,可以下发启动参数文件"。
#[tauri::command]
fn frontend_ready(app: AppHandle) {
    if let Some(state) = app.try_state::<StartupFile>() {
        if let Some(path) = state.0.clone() {
            dispatch_open_file(&app, path);
        }
    }
}

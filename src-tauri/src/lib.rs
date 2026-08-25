// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(target_os = "macos")]
mod native_panel;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PanelStatus {
    visible: bool,
    focused: bool,
    bridge_ready: bool,
}

struct PanelState(std::sync::Mutex<PanelStatus>);

#[tauri::command]
fn save_file(path: &str, content: &str, encoding: Option<&str>, line_ending: Option<&str>) -> Result<(), String> {
    if path.is_empty() { return Err("save path is empty".into()); }
    let source = content.replace("\r\n", "\n").replace('\r', "\n");
    let normalized = match line_ending.unwrap_or("\n") { "\r\n" => source.replace('\n', "\r\n"), "\r" => source.replace('\n', "\r"), _ => source };
    let bytes = match encoding.unwrap_or("utf-8").to_ascii_lowercase().as_str() {
        "utf-8-bom" => [vec![0xEF, 0xBB, 0xBF], normalized.as_bytes().to_vec()].concat(),
        "utf-16le" => [vec![0xFF, 0xFE], encoding_rs::UTF_16LE.encode(&normalized).0.into_owned()].concat(),
        "utf-16be" => [vec![0xFE, 0xFF], encoding_rs::UTF_16BE.encode(&normalized).0.into_owned()].concat(),
        "gb18030" => encoding_rs::GB18030.encode(&normalized).0.into_owned(),
        _ => normalized.as_bytes().to_vec(),
    };
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[derive(Serialize)]
struct OpenedFile { path: String, content: String, language: String, encoding: String, line_ending: String }

#[derive(Serialize)]
struct PreviewFile { path: String, data_url: String, mime: String }

#[tauri::command]
fn open_text_file(path: &str) -> Result<OpenedFile, String> {
    let size = std::fs::metadata(path).map_err(|error| format!("无法读取文件信息：{error}"))?.len();
    if size > 20 * 1024 * 1024 { return Err("文本文件超过 20 MB 限制".into()); }
    let bytes = std::fs::read(path).map_err(|error| format!("不支持或无法读取此文件：{error}"))?;
    let (encoding, content) = if bytes.starts_with(&[0xFF, 0xFE]) { ("utf-16le", encoding_rs::UTF_16LE.decode(&bytes[2..]).0.into_owned()) } else if bytes.starts_with(&[0xFE, 0xFF]) { ("utf-16be", encoding_rs::UTF_16BE.decode(&bytes[2..]).0.into_owned()) } else if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) { ("utf-8-bom", String::from_utf8_lossy(&bytes[3..]).into_owned()) } else if let Ok(content) = std::str::from_utf8(&bytes) { ("utf-8", content.to_string()) } else { ("gb18030", encoding_rs::GB18030.decode(&bytes).0.into_owned()) };
    let language = std::path::Path::new(path).extension().and_then(|ext| ext.to_str()).unwrap_or("plaintext").to_ascii_lowercase();
    let line_ending = if content.contains("\r\n") { "\r\n" } else if content.contains('\r') { "\r" } else { "\n" };
    Ok(OpenedFile { path: path.to_string(), content, language, encoding: encoding.to_string(), line_ending: line_ending.to_string() })
}

#[tauri::command]
fn preview_file(path: &str) -> Result<PreviewFile, String> {
    let extension = std::path::Path::new(path).extension().and_then(|ext| ext.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime = match extension.as_str() { "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp", "pdf" => "application/pdf", _ => return Err("此文件不支持预览".into()) };
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    let data_url = format!("data:{mime};base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes));
    Ok(PreviewFile { path: path.to_string(), data_url, mime: mime.to_string() })
}

#[tauri::command]
fn set_panel_pinned(pinned: bool, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { app.state::<native_panel::NativePanel>().set_pinned(pinned)?; }
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle) { app.exit(0); }

#[tauri::command]
fn startup_paths() -> Vec<String> { std::env::args().skip(1).filter(|path| !path.starts_with('-')).collect() }

#[tauri::command]
fn set_menu_bar_icon_visible(visible: bool, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { app.state::<native_panel::NativePanel>().set_status_item_visible(visible)?; }
    Ok(())
}

#[tauri::command]
fn set_edge_modifier(modifier: &str, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        app.state::<native_panel::NativePanel>().set_edge_modifier(modifier, &app)?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (modifier, app);
    Ok(())
}

#[tauri::command]
fn panel_action(action: &str, app: AppHandle, state: State<'_, PanelState>) -> Result<PanelStatus, String> {
    if !matches!(action, "show" | "focus" | "hide") {
        return Err("unsupported panel action".into());
    }
    let mut status = state.0.lock().map_err(|_| "panel state unavailable")?;
    #[cfg(target_os = "macos")]
    let native_result = app.state::<native_panel::NativePanel>().action(action)?;
    #[cfg(not(target_os = "macos"))]
    let native_result = match action {
        "show" | "focus" => (true, true),
        "hide" => (false, false),
        _ => unreachable!(),
    };
    (status.visible, status.focused) = native_result;
    let next = status.clone();
    app.emit("panel_status", next.clone()).map_err(|error| error.to_string())?;
    Ok(next)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = PanelState(std::sync::Mutex::new(PanelStatus { visible: true, focused: true, bridge_ready: false }));
    let builder = tauri::Builder::default().manage(state);
    #[cfg(target_os = "macos")]
    let builder = builder.manage(native_panel::NativePanel::default());
    builder
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let paths: Vec<String> = args.into_iter().skip(1).filter(|path| !path.starts_with('-')).collect();
            if !paths.is_empty() { let _ = app.emit("open_paths", paths); }
            #[cfg(target_os = "macos")]
            if let Some(panel) = app.try_state::<native_panel::NativePanel>() {
                let _ = panel.action("show");
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![panel_action, save_file, open_text_file, preview_file, set_panel_pinned, quit_app, startup_paths, set_menu_bar_icon_visible, set_edge_modifier])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let panel = app.state::<native_panel::NativePanel>();
                let _ = native_panel::NativePanel::set_accessory_activation_policy();
                let _ = panel.install_status_item();
                native_panel::attach_from_setup(app.handle(), &panel)
                    .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
                panel.install_dismiss_monitor()
                    .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
                let _ = panel.start_edge_trigger(app.handle());
            }
            let state = app.state::<PanelState>();
            if let Ok(mut status) = state.0.lock() {
                status.bridge_ready = true;
                let _ = app.emit("panel_status", status.clone());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

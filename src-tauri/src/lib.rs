// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, State};

const MAX_TEXT_FILE_SIZE: u64 = 20 * 1024 * 1024;
const MAX_PREVIEW_FILE_SIZE: u64 = 200 * 1024 * 1024;
const MAX_GENERATED_PREVIEW_SIZE: u64 = 25 * 1024 * 1024;

#[cfg(target_os = "macos")]
mod native_panel;
mod shutdown;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PanelStatus {
    visible: bool,
    focused: bool,
    bridge_ready: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    trigger_edge: Option<String>,
}

struct PanelState(std::sync::Mutex<PanelStatus>);

#[tauri::command]
fn save_file(path: &str, content: &str, encoding: Option<&str>, line_ending: Option<&str>) -> Result<(), String> {
    if path.is_empty() { return Err("保存路径为空".into()); }
    let target = Path::new(path);
    if target.exists() && !target.is_file() {
        return Err("无法写回原文件：绑定路径已不是普通文件".into());
    }
    let parent = target.parent().ok_or("无法写回文件：保存路径无效")?;
    if !parent.is_dir() {
        return Err("无法写回原文件：原目录已不存在，请另存为新文件".into());
    }
    let source = content.replace("\r\n", "\n").replace('\r', "\n");
    let normalized = match line_ending.unwrap_or("\n") { "\r\n" => source.replace('\n', "\r\n"), "\r" => source.replace('\n', "\r"), _ => source };
    let bytes = match encoding.unwrap_or("utf-8").to_ascii_lowercase().as_str() {
        "utf-8-bom" => [vec![0xEF, 0xBB, 0xBF], normalized.as_bytes().to_vec()].concat(),
        "utf-16le" => [vec![0xFF, 0xFE], encoding_rs::UTF_16LE.encode(&normalized).0.into_owned()].concat(),
        "utf-16be" => [vec![0xFE, 0xFF], encoding_rs::UTF_16BE.encode(&normalized).0.into_owned()].concat(),
        "gb18030" => encoding_rs::GB18030.encode(&normalized).0.into_owned(),
        _ => normalized.as_bytes().to_vec(),
    };
    std::fs::write(target, bytes).map_err(|error| format!("无法写回文件：{error}"))
}

#[derive(Serialize)]
struct OpenedFile { path: String, content: String, language: String, encoding: String, line_ending: String }

#[derive(Serialize)]
struct PreviewFile { path: String, data_url: String, mime: String }

#[tauri::command]
fn open_text_file(path: &str) -> Result<OpenedFile, String> {
    let metadata = std::fs::metadata(path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if !metadata.is_file() { return Err("所选路径不是普通文件".into()); }
    if metadata.len() > MAX_TEXT_FILE_SIZE { return Err("文本文件超过 20 MB 限制".into()); }
    let bytes = std::fs::read(path).map_err(|error| format!("不支持或无法读取此文件：{error}"))?;
    let (encoding, content) = decode_text(&bytes)?;
    let language = std::path::Path::new(path).extension().and_then(|ext| ext.to_str()).unwrap_or("plaintext").to_ascii_lowercase();
    let line_ending = if content.contains("\r\n") { "\r\n" } else if content.contains('\r') { "\r" } else { "\n" };
    Ok(OpenedFile { path: path.to_string(), content, language, encoding: encoding.to_string(), line_ending: line_ending.to_string() })
}

#[tauri::command]
fn preview_file(path: &str) -> Result<PreviewFile, String> {
    let source = Path::new(path);
    let metadata = std::fs::metadata(source).map_err(|error| format!("无法读取预览文件：{error}"))?;
    if !metadata.is_file() { return Err("所选路径不是普通文件".into()); }
    if metadata.len() > MAX_PREVIEW_FILE_SIZE { return Err("预览文件超过 200 MB 限制".into()); }
    let bytes = std::fs::read(source).map_err(|error| format!("无法读取预览文件：{error}"))?;
    let mime = detect_embeddable_preview(&bytes);
    let (bytes, mime) = match mime {
        Some(mime) => (bytes, mime),
        None => (quick_look_thumbnail(source)?, "image/png"),
    };
    let data_url = format!("data:{mime};base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes));
    Ok(PreviewFile { path: path.to_string(), data_url, mime: mime.to_string() })
}

fn decode_text(bytes: &[u8]) -> Result<(&'static str, String), String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (content, _, had_errors) = encoding_rs::UTF_16LE.decode(&bytes[2..]);
        return (!had_errors).then(|| ("utf-16le", content.into_owned())).ok_or_else(|| "文件不是有效的 UTF-16LE 文本".into());
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        let (content, _, had_errors) = encoding_rs::UTF_16BE.decode(&bytes[2..]);
        return (!had_errors).then(|| ("utf-16be", content.into_owned())).ok_or_else(|| "文件不是有效的 UTF-16BE 文本".into());
    }
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let content = std::str::from_utf8(&bytes[3..]).map_err(|_| "文件带有 UTF-8 标记，但内容不是有效文本")?;
        return Ok(("utf-8-bom", content.to_string()));
    }
    if looks_binary(bytes) { return Err("检测到二进制内容，未作为文本打开".into()); }
    if let Ok(content) = std::str::from_utf8(bytes) { return Ok(("utf-8", content.to_string())); }
    let (content, _, had_errors) = encoding_rs::GB18030.decode(bytes);
    if had_errors || looks_binary_text(&content) {
        return Err("无法识别为受支持的文本编码".into());
    }
    Ok(("gb18030", content.into_owned()))
}

fn looks_binary(bytes: &[u8]) -> bool {
    if bytes.is_empty() { return false; }
    if bytes.iter().any(|byte| *byte == 0) { return true; }
    let controls = bytes.iter().filter(|byte| **byte < 0x20 && !matches!(**byte, b'\t' | b'\n' | b'\r' | 0x0C)).count();
    controls * 100 > bytes.len()
}

fn looks_binary_text(content: &str) -> bool {
    let count = content.chars().count();
    if count == 0 { return false; }
    let controls = content.chars().filter(|character| character.is_control() && !matches!(*character, '\t' | '\n' | '\r')).count();
    controls * 100 > count
}

fn detect_embeddable_preview(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"%PDF-") { return Some("application/pdf"); }
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Some("image/png"); }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) { return Some("image/jpeg"); }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") { return Some("image/gif"); }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" { return Some("image/webp"); }
    None
}

#[cfg(target_os = "macos")]
fn quick_look_thumbnail(source: &Path) -> Result<Vec<u8>, String> {
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let output_dir: PathBuf = std::env::temp_dir().join(format!("edgedor-quicklook-{}-{nonce}", std::process::id()));
    std::fs::create_dir(&output_dir).map_err(|error| format!("无法创建 Quick Look 临时目录：{error}"))?;
    let result = (|| {
        let mut child = Command::new("/usr/bin/qlmanage")
            .args(["-t", "-x", "-s", "1600", "-o"])
            .arg(&output_dir)
            .arg(source)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("无法调用系统 Quick Look：{error}"))?;
        let deadline = Instant::now() + Duration::from_secs(15);
        let status = loop {
            if let Some(status) = child.try_wait().map_err(|error| format!("无法等待系统 Quick Look：{error}"))? {
                break status;
            }
            if Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Quick Look 预览超时".into());
            }
            std::thread::sleep(Duration::from_millis(25));
        };
        if !status.success() { return Err("macOS Quick Look 不支持此文件".into()); }
        let preview_path = std::fs::read_dir(&output_dir)
            .map_err(|error| format!("无法读取 Quick Look 输出：{error}"))?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .find(|path| path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("png")))
            .ok_or_else(|| "macOS Quick Look 未生成可显示的预览".to_string())?;
        let metadata = std::fs::metadata(&preview_path).map_err(|error| format!("无法读取 Quick Look 输出：{error}"))?;
        if metadata.len() > MAX_GENERATED_PREVIEW_SIZE { return Err("Quick Look 预览超过 25 MB 限制".into()); }
        std::fs::read(preview_path).map_err(|error| format!("无法读取 Quick Look 预览：{error}"))
    })();
    let _ = std::fs::remove_dir_all(&output_dir);
    result
}

#[cfg(not(target_os = "macos"))]
fn quick_look_thumbnail(_source: &Path) -> Result<Vec<u8>, String> {
    Err("此文件不支持预览".into())
}

#[cfg(test)]
mod file_tests {
    use super::{decode_text, detect_embeddable_preview};

    #[test]
    fn rejects_binary_instead_of_guessing_gb18030() {
        assert!(decode_text(b"PK\x03\x04\0\0\0binary").is_err());
        assert!(decode_text(&[1, 2, 3, 4, 5, 6, 7, 8]).is_err());
    }

    #[test]
    fn accepts_supported_text_encodings() {
        assert_eq!(decode_text("临时代码".as_bytes()).unwrap().0, "utf-8");
        let (encoded, _, _) = encoding_rs::GB18030.encode("临时代码");
        assert_eq!(decode_text(&encoded).unwrap().0, "gb18030");
    }

    #[test]
    fn preview_type_comes_from_signature() {
        assert_eq!(detect_embeddable_preview(b"%PDF-1.7"), Some("application/pdf"));
        assert_eq!(detect_embeddable_preview(b"not really a png"), None);
    }
}

#[tauri::command]
fn set_panel_pinned(pinned: bool, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { app.state::<native_panel::NativePanel>().set_pinned(pinned)?; }
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle, shutdown: State<'_, std::sync::Mutex<shutdown::ShutdownState>>) -> Result<(), String> {
    shutdown.lock().map_err(|_| "shutdown state unavailable")?.confirm_exit();
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn startup_paths() -> Vec<String> { std::env::args().skip(1).filter(|path| !path.starts_with('-')).collect() }

#[tauri::command]
fn set_menu_bar_icon_visible(visible: bool, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { app.state::<native_panel::NativePanel>().set_status_item_visible(visible)?; }
    Ok(())
}

#[tauri::command]
fn set_dock_icon_visible(visible: bool, _app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { native_panel::NativePanel::set_dock_icon_visible(visible)?; }
    #[cfg(not(target_os = "macos"))]
    let _ = (visible, _app);
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
fn set_edge_trigger_options(left_enabled: bool, right_enabled: bool, dwell_ms: u64, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { app.state::<native_panel::NativePanel>().set_edge_trigger_options(left_enabled, right_enabled, dwell_ms, &app)?; }
    #[cfg(not(target_os = "macos"))]
    let _ = (left_enabled, right_enabled, dwell_ms, app);
    Ok(())
}

#[tauri::command]
fn set_panel_animation(enabled: bool, duration_ms: u64, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { app.state::<native_panel::NativePanel>().set_panel_animation(enabled, duration_ms)?; }
    #[cfg(not(target_os = "macos"))]
    let _ = (enabled, duration_ms, app);
    Ok(())
}

#[tauri::command]
fn panel_action(action: &str, app: AppHandle, state: State<'_, PanelState>) -> Result<PanelStatus, String> {
    if !matches!(action, "show" | "focus" | "hide" | "lower") {
        return Err("unsupported panel action".into());
    }
    let mut status = state.0.lock().map_err(|_| "panel state unavailable")?;
    #[cfg(target_os = "macos")]
    let native_result = app.state::<native_panel::NativePanel>().action(action)?;
    #[cfg(not(target_os = "macos"))]
    let native_result = match action {
        "show" | "focus" => (true, true),
        "hide" => (false, false),
        "lower" => (status.visible, false),
        _ => unreachable!(),
    };
    (status.visible, status.focused) = native_result;
    if matches!(action, "show" | "hide") {
        status.trigger_edge = None;
    }
    let next = status.clone();
    app.emit("panel_status", next.clone()).map_err(|error| error.to_string())?;
    Ok(next)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = PanelState(std::sync::Mutex::new(PanelStatus { visible: false, focused: false, bridge_ready: false, trigger_edge: None }));
    let builder = tauri::Builder::default()
        .manage(state)
        .manage(std::sync::Mutex::new(shutdown::ShutdownState::default()));
    #[cfg(target_os = "macos")]
    let builder = builder.manage(native_panel::NativePanel::default());
    let app = builder
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
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![panel_action, save_file, open_text_file, preview_file, set_panel_pinned, quit_app, startup_paths, set_menu_bar_icon_visible, set_dock_icon_visible, set_edge_modifier, set_edge_trigger_options, set_panel_animation])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let panel = app.state::<native_panel::NativePanel>();
                let _ = native_panel::NativePanel::set_accessory_activation_policy();
                let _ = panel.install_status_item();
                native_panel::attach_from_setup(app.handle(), &panel)
                    .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
                let _ = panel.action("hide");
                panel.install_dismiss_monitor(app.handle())
                    .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
                if let Err(error) = panel.start_edge_trigger(app.handle()) {
                    eprintln!("Edgedor edge trigger startup failed: {error}");
                }
            }
            let state = app.state::<PanelState>();
            if let Ok(mut status) = state.0.lock() {
                status.bridge_ready = true;
                let _ = app.emit("panel_status", status.clone());
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");
    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { code, api, .. } = event {
            let decision = app
                .state::<std::sync::Mutex<shutdown::ShutdownState>>()
                .lock()
                .map(|mut state| state.exit_requested(code))
                .unwrap_or(shutdown::ExitDecision::Prevent);
            match decision {
                shutdown::ExitDecision::Allow => {}
                shutdown::ExitDecision::PreventAndRequestCheckpoint => {
                    api.prevent_exit();
                    let _ = app.emit("quit_requested", ());
                }
                shutdown::ExitDecision::Prevent => api.prevent_exit(),
            }
        }
    });
}

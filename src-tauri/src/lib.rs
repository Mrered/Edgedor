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
fn save_file(path: &str, content: &str) -> Result<(), String> {
    if path.is_empty() { return Err("save path is empty".into()); }
    std::fs::write(path, content).map_err(|error| error.to_string())
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            #[cfg(target_os = "macos")]
            if let Some(panel) = app.try_state::<native_panel::NativePanel>() {
                let _ = panel.action("show");
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![panel_action, save_file])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let panel = app.state::<native_panel::NativePanel>();
                native_panel::attach_from_setup(app.handle(), &panel)
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

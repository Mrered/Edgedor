// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PanelStatus {
    visible: bool,
    focused: bool,
    bridge_ready: bool,
}

struct PanelState(std::sync::Mutex<PanelStatus>);

#[tauri::command]
fn panel_action(action: &str, app: AppHandle, state: State<'_, PanelState>) -> Result<PanelStatus, String> {
    if !matches!(action, "show" | "focus" | "hide") {
        return Err("unsupported panel action".into());
    }
    let mut status = state.0.lock().map_err(|_| "panel state unavailable")?;
    match action {
        "show" => { status.visible = true; status.focused = true; }
        "focus" => { status.visible = true; status.focused = true; }
        "hide" => { status.visible = false; status.focused = false; }
        _ => unreachable!(),
    }
    let next = status.clone();
    app.emit("panel_status", next.clone()).map_err(|error| error.to_string())?;
    Ok(next)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = PanelState(std::sync::Mutex::new(PanelStatus { visible: true, focused: true, bridge_ready: false }));
    tauri::Builder::default()
        .manage(state)
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![panel_action])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

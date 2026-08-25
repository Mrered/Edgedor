//! macOS-only native panel owner.
//!
//! The Tauri window remains the runtime owner of the WebView, while Wry's
//! macOS reparent operation moves that WebView into this retained `NSPanel`.
//! The panel pointer is intentionally kept as an opaque address because
//! AppKit objects are main-thread confined and cannot be put in Tauri state.

use std::sync::Mutex;

use objc2::runtime::AnyObject;
use objc2::{MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{NSBackingStoreType, NSPanel, NSView, NSWindowStyleMask, NSFloatingWindowLevel};
use objc2_foundation::{NSPoint, NSRect, NSSize};
use tauri::{AppHandle, Manager, WebviewWindow};

#[derive(Default)]
pub struct NativePanel {
    panel: Mutex<Option<usize>>,
}

impl NativePanel {
    fn panel(&self) -> Option<&'static NSPanel> {
        let pointer = *self.panel.lock().ok()?.as_ref()?;
        // The retained object is released only when the process exits. All
        // calls happen on AppKit's main thread through Tauri setup/commands.
        Some(unsafe { &*(pointer as *const NSPanel) })
    }

    fn create(&self) -> Result<&'static NSPanel, String> {
        if let Some(panel) = self.panel() {
            return Ok(panel);
        }
        let marker = MainThreadMarker::new().ok_or("NSPanel must be created on the main thread")?;
        let style = NSWindowStyleMask::Borderless | NSWindowStyleMask::Resizable;
        let panel = unsafe {
            NSPanel::initWithContentRect_styleMask_backing_defer(
                NSPanel::alloc(marker),
                NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(800.0, 600.0)),
                style,
                NSBackingStoreType::Buffered,
                false,
            )
        };
        panel.setFloatingPanel(true);
        panel.setHidesOnDeactivate(false);
        panel.setLevel(NSFloatingWindowLevel);
        let pointer = RetainedPanel::leak(panel);
        *self.panel.lock().map_err(|_| "native panel state unavailable")? = Some(pointer);
        self.panel().ok_or_else(|| "native panel was not retained".into())
    }

    pub fn attach(&self, window: &WebviewWindow) -> Result<(), String> {
        let panel = self.create()?;
        let panel_content = panel.contentView().ok_or("NSPanel has no content view")?;
        let panel_content_pointer = RetainedPanel::leak_view(panel_content);
        window
            .with_webview(move |webview| {
                // Tauri exposes the platform WKWebView as an opaque pointer.
                // WKWebView is an NSView subclass, so AppKit can safely move
                // it between the runtime window and our native panel.
                let panel_content = unsafe { &*(panel_content_pointer as *const NSView) };
                let view = unsafe { &*(webview.inner() as *const NSView) };
                view.removeFromSuperview();
                panel_content.addSubview(view);
                view.setFrame(panel_content.bounds());
            })
            .map_err(|error| error.to_string())
    }

    pub fn action(&self, action: &str) -> Result<(bool, bool), String> {
        let panel = self.create()?;
        match action {
            "show" => {
                panel.orderFrontRegardless();
                panel.makeKeyAndOrderFront(None::<&AnyObject>);
                Ok((true, true))
            }
            "focus" => {
                panel.makeKeyAndOrderFront(None::<&AnyObject>);
                Ok((true, true))
            }
            "hide" => {
                panel.orderOut(None::<&AnyObject>);
                Ok((false, false))
            }
            _ => Err("unsupported panel action".into()),
        }
    }
}

struct RetainedPanel;

impl RetainedPanel {
    fn leak(panel: objc2::rc::Retained<NSPanel>) -> usize {
        // Keep the +1 retain for the whole process; NSPanel is app-lifetime.
        objc2::rc::Retained::into_raw(panel) as usize
    }

    fn leak_view(view: objc2::rc::Retained<NSView>) -> usize {
        objc2::rc::Retained::into_raw(view) as usize
    }
}

pub fn attach_from_setup(app: &AppHandle, state: &NativePanel) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main WebView window not found".to_string())?;
    state.attach(&window)
}

//! macOS-only native panel owner.
//!
//! The Tauri window remains the runtime owner of the WebView, while Wry's
//! macOS reparent operation moves that WebView into this retained `NSPanel`.
//! The panel pointer is intentionally kept as an opaque address because
//! AppKit objects are main-thread confined and cannot be put in Tauri state.

use std::sync::{Arc, Mutex};
use std::time::Instant;

use objc2::runtime::AnyObject;
use objc2::{sel, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy, NSAutoresizingMaskOptions, NSBackingStoreType, NSEvent, NSEventMask, NSEventModifierFlags, NSMenu, NSMenuItem, NSPanel, NSStatusBar, NSView, NSWindowCollectionBehavior, NSWindowStyleMask, NSWindowTitleVisibility, NSFloatingWindowLevel, NSNormalWindowLevel, NSScreen};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSTimer, NSUserDefaults};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

const DEFAULT_PANEL_ANIMATION_MS: u64 = 180;
const PANEL_WIDTH_RATIO_KEY: &str = "EdgedorPanelWidthRatio";

#[path = "edge_trigger.rs"]
pub mod edge_trigger;

pub struct NativePanel {
    panel: Mutex<Option<usize>>,
    trigger: edge_trigger::EdgeTrigger,
    edge_modifier: Mutex<NSEventModifierFlags>,
    edge_left_enabled: Mutex<bool>,
    edge_right_enabled: Mutex<bool>,
    edge_dwell_ms: Mutex<u64>,
    animation_enabled: Arc<Mutex<bool>>,
    animation_duration_ms: Arc<Mutex<u64>>,
    pinned: Arc<Mutex<bool>>,
    width_ratio: Arc<Mutex<f64>>,
    last_target: Mutex<Option<(f64, f64, f64, f64)>>,
    status_item: Mutex<Option<usize>>,
    dismiss_monitor: Mutex<Option<usize>>,
}

impl Default for NativePanel {
    fn default() -> Self {
        Self {
            panel: Mutex::new(None),
            trigger: edge_trigger::EdgeTrigger::default(),
            edge_modifier: Mutex::new(NSEventModifierFlags::Command),
            edge_left_enabled: Mutex::new(true),
            edge_right_enabled: Mutex::new(true),
            edge_dwell_ms: Mutex::new(150),
            animation_enabled: Arc::new(Mutex::new(true)),
            animation_duration_ms: Arc::new(Mutex::new(DEFAULT_PANEL_ANIMATION_MS)),
            pinned: Arc::new(Mutex::new(false)),
            width_ratio: Arc::new(Mutex::new(saved_width_ratio())),
            last_target: Mutex::new(None),
            status_item: Mutex::new(None),
            dismiss_monitor: Mutex::new(None),
        }
    }
}

impl NativePanel {
    pub fn set_accessory_activation_policy() -> Result<(), String> {
        let marker = MainThreadMarker::new().ok_or("application policy must be set on the main thread")?;
        if NSApplication::sharedApplication(marker).setActivationPolicy(NSApplicationActivationPolicy::Accessory) { Ok(()) } else { Err("unable to set accessory activation policy".into()) }
    }

    pub fn set_dock_icon_visible(visible: bool) -> Result<(), String> {
        let marker = MainThreadMarker::new().ok_or("Dock policy must be set on the main thread")?;
        let policy = if visible { NSApplicationActivationPolicy::Regular } else { NSApplicationActivationPolicy::Accessory };
        if NSApplication::sharedApplication(marker).setActivationPolicy(policy) { Ok(()) } else { Err("unable to set Dock icon policy".into()) }
    }

    pub fn install_status_item(&self) -> Result<(), String> {
        if self.status_item.lock().map_err(|_| "status item state unavailable")?.is_some() { return Ok(()); }
        let marker = MainThreadMarker::new().ok_or("status item must be created on the main thread")?;
        let panel = self.create()?;
        let item = NSStatusBar::systemStatusBar().statusItemWithLength(-2.0);
        let menu = NSMenu::initWithTitle(NSMenu::alloc(marker), &NSString::from_str("Edgedor"));
        let show_item = unsafe {
            NSMenuItem::initWithTitle_action_keyEquivalent(
                NSMenuItem::alloc(marker),
                &NSString::from_str("显示 Edgedor"),
                Some(sel!(makeKeyAndOrderFront:)),
                &NSString::from_str(""),
            )
        };
        unsafe { show_item.setTarget(Some(panel as &AnyObject)); }
        menu.addItem(&show_item);
        menu.addItem(&NSMenuItem::separatorItem(marker));
        let quit_item = unsafe {
            NSMenuItem::initWithTitle_action_keyEquivalent(
                NSMenuItem::alloc(marker),
                &NSString::from_str("退出 Edgedor"),
                Some(sel!(terminate:)),
                &NSString::from_str(""),
            )
        };
        let application = NSApplication::sharedApplication(marker);
        unsafe { quit_item.setTarget(Some(&application as &AnyObject)); }
        menu.addItem(&quit_item);
        item.setMenu(Some(&menu));
        if let Some(button) = item.button(marker) { button.setTitle(&NSString::from_str("Edgedor")); }
        *self.status_item.lock().map_err(|_| "status item state unavailable")? = Some(RetainedPanel::leak_status_item(item));
        Ok(())
    }

    pub fn set_status_item_visible(&self, visible: bool) -> Result<(), String> {
        if visible { return self.install_status_item(); }
        let mut item = self.status_item.lock().map_err(|_| "status item state unavailable")?;
        if let Some(pointer) = item.take() {
            let status_bar = NSStatusBar::systemStatusBar();
            let item_ref = unsafe { &*(pointer as *const objc2_app_kit::NSStatusItem) };
            status_bar.removeStatusItem(item_ref);
        }
        Ok(())
    }

    pub fn start_edge_trigger(&self, app: &AppHandle) -> Result<(), String> {
        let app = app.clone();
        let modifier = *self.edge_modifier.lock().map_err(|_| "edge modifier state unavailable")?;
        let left_enabled = *self.edge_left_enabled.lock().map_err(|_| "left edge state unavailable")?;
        let right_enabled = *self.edge_right_enabled.lock().map_err(|_| "right edge state unavailable")?;
        let dwell_ms = *self.edge_dwell_ms.lock().map_err(|_| "edge dwell state unavailable")?;
        self.trigger.start(edge_trigger::EdgeTriggerConfig {
            modifier,
            hold_duration: std::time::Duration::from_millis(dwell_ms),
            left_enabled,
            right_enabled,
            ..Default::default()
        }, move |_edge, point| {
            if let Some(panel) = app.try_state::<NativePanel>() {
                if let Err(error) = panel.show_at_edge_at(_edge, point) {
                    eprintln!("Edgedor edge panel show failed: {error}");
                } else {
                    let _ = app.emit("panel_status", serde_json::json!({"visible": true, "focused": true, "bridgeReady": true}));
                }
            }
        })
    }

    pub fn set_edge_modifier(&self, modifier: &str, app: &AppHandle) -> Result<(), String> {
        let flags = edge_trigger::modifier_flags(modifier)?;
        *self.edge_modifier.lock().map_err(|_| "edge modifier state unavailable")? = flags;
        let app = app.clone();
        let dispatch_app = app.clone();
        app.run_on_main_thread(move || {
            if let Some(panel) = dispatch_app.try_state::<NativePanel>() {
                panel.trigger.stop();
                if let Err(error) = panel.start_edge_trigger(&dispatch_app) {
                    eprintln!("Edgedor edge trigger restart failed: {error}");
                }
            }
        })
        .map_err(|error| error.to_string())
    }

    pub fn set_edge_trigger_options(
        &self,
        left_enabled: bool,
        right_enabled: bool,
        dwell_ms: u64,
        app: &AppHandle,
    ) -> Result<(), String> {
        if !(50..=2_000).contains(&dwell_ms) {
            return Err("edge dwell must be between 50 and 2000 milliseconds".into());
        }
        *self.edge_left_enabled.lock().map_err(|_| "left edge state unavailable")? = left_enabled;
        *self.edge_right_enabled.lock().map_err(|_| "right edge state unavailable")? = right_enabled;
        *self.edge_dwell_ms.lock().map_err(|_| "edge dwell state unavailable")? = dwell_ms;
        self.restart_edge_trigger(app)
    }

    pub fn set_panel_animation(&self, enabled: bool, duration_ms: u64) -> Result<(), String> {
        if !(50..=1_000).contains(&duration_ms) {
            return Err("panel animation duration must be between 50 and 1000 milliseconds".into());
        }
        *self.animation_enabled.lock().map_err(|_| "animation state unavailable")? = enabled;
        *self.animation_duration_ms.lock().map_err(|_| "animation duration state unavailable")? = duration_ms;
        Ok(())
    }

    fn restart_edge_trigger(&self, app: &AppHandle) -> Result<(), String> {
        let app = app.clone();
        let dispatch_app = app.clone();
        app.run_on_main_thread(move || {
            if let Some(panel) = dispatch_app.try_state::<NativePanel>() {
                panel.trigger.stop();
                if let Err(error) = panel.start_edge_trigger(&dispatch_app) {
                    eprintln!("Edgedor edge trigger restart failed: {error}");
                }
            }
        })
        .map_err(|error| error.to_string())
    }

    fn show_at_edge_at(&self, edge: edge_trigger::Edge, point: (f64, f64)) -> Result<(), String> {
        eprintln!("Edgedor edge trigger fired: {edge:?}");
        let panel = self.create()?;
        let marker = MainThreadMarker::new().ok_or("NSPanel must be shown on the main thread")?;
        let application = NSApplication::sharedApplication(marker);
        #[allow(deprecated)]
        application.activateIgnoringOtherApps(true);
        // Use the pointer captured at trigger time; do not let a subsequent
        // cross-screen pointer move change the destination during animation.
        let trigger_point = NSPoint::new(point.0, point.1);
        let screen = screen_at(trigger_point, marker)
            .or_else(|| NSScreen::mainScreen(marker))
            .ok_or("no screen available")?;
        let frame = screen.visibleFrame();
        let was_visible = panel.isVisible();
        let was_on_active_space = panel.isOnActiveSpace();
        if was_visible && was_on_active_space { capture_width_ratio(panel, &self.width_ratio); }
        let ratio = self.width_ratio.lock().map(|ratio| *ratio).unwrap_or(0.35).clamp(0.20, 0.60);
        let width = (frame.size.width * ratio).clamp(320.0, frame.size.width * 0.60);
        let x = match edge { edge_trigger::Edge::Left => frame.origin.x, edge_trigger::Edge::Right => frame.origin.x + frame.size.width - width };
        let target = NSRect::new(NSPoint::new(x, frame.origin.y), NSSize::new(width, frame.size.height));
        if let Ok(mut last_target) = self.last_target.lock() {
            *last_target = Some((target.origin.x, target.origin.y, target.size.width, target.size.height));
        }
        let start = if panel.isVisible() {
            panel.frame()
        } else {
            let start_x = match edge {
                edge_trigger::Edge::Left => target.origin.x - target.size.width,
                edge_trigger::Edge::Right => target.origin.x + target.size.width,
            };
            NSRect::new(NSPoint::new(start_x, target.origin.y), target.size)
        };
        panel.setFrame_display(start, false);
        panel.orderFrontRegardless();
        panel.makeKeyAndOrderFront(None::<&AnyObject>);
        let animation_enabled = self.animation_enabled.lock().map(|value| *value).unwrap_or(true);
        let animation_duration_ms = self.animation_duration_ms.lock().map(|value| *value).unwrap_or(DEFAULT_PANEL_ANIMATION_MS);
        animate_panel_frame(panel, start, target, false, animation_enabled, animation_duration_ms);
        eprintln!(
            "Edgedor edge panel shown: edge={edge:?} app_active={} was_visible={was_visible} was_on_active_space={was_on_active_space} visible={} on_active_space={} target=({:.0},{:.0},{:.0},{:.0}) actual=({:.0},{:.0},{:.0},{:.0})",
            application.isActive(),
            panel.isVisible(),
            panel.isOnActiveSpace(),
            target.origin.x,
            target.origin.y,
            target.size.width,
            target.size.height,
            panel.frame().origin.x,
            panel.frame().origin.y,
            panel.frame().size.width,
            panel.frame().size.height,
        );
        Ok(())
    }

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
        let style = NSWindowStyleMask::Titled | NSWindowStyleMask::FullSizeContentView | NSWindowStyleMask::Resizable;
        let panel = NSPanel::initWithContentRect_styleMask_backing_defer(
                NSPanel::alloc(marker),
                NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(800.0, 600.0)),
                style,
                NSBackingStoreType::Buffered,
                false,
            );
        panel.setTitleVisibility(NSWindowTitleVisibility::Hidden);
        panel.setTitlebarAppearsTransparent(true);
        panel.setBecomesKeyOnlyIfNeeded(false);
        panel.setFloatingPanel(true);
        // Keep the panel visible while activating from another application;
        // the global click monitor owns unpinned dismissal to avoid AppKit
        // hiding the panel before a cross-application edge trigger completes.
        panel.setHidesOnDeactivate(false);
        panel.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::Transient
                | NSWindowCollectionBehavior::IgnoresCycle,
        );
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
                view.setAutoresizingMask(NSAutoresizingMaskOptions::ViewWidthSizable | NSAutoresizingMaskOptions::ViewHeightSizable);
                view.setFrame(panel_content.bounds());
            })
            .map_err(|error| error.to_string())
    }

    pub fn action(&self, action: &str) -> Result<(bool, bool), String> {
        let panel = self.create()?;
        match action {
            "show" => {
                let marker = MainThreadMarker::new().ok_or("NSPanel must be shown on the main thread")?;
                #[allow(deprecated)]
                NSApplication::sharedApplication(marker).activateIgnoringOtherApps(true);
                panel.setLevel(NSFloatingWindowLevel);
                if let Ok(last_target) = self.last_target.lock() {
                    if let Some((x, y, width, height)) = *last_target {
                        panel.setFrame_display(NSRect::new(NSPoint::new(x, y), NSSize::new(width, height)), false);
                    }
                }
                panel.orderFrontRegardless();
                panel.makeKeyAndOrderFront(None::<&AnyObject>);
                Ok((true, true))
            }
            "focus" => {
                panel.setLevel(NSFloatingWindowLevel);
                panel.makeKeyAndOrderFront(None::<&AnyObject>);
                Ok((true, true))
            }
            "hide" => {
                capture_width_ratio(panel, &self.width_ratio);
                let animation_enabled = self.animation_enabled.lock().map(|value| *value).unwrap_or(true);
                let animation_duration_ms = self.animation_duration_ms.lock().map(|value| *value).unwrap_or(DEFAULT_PANEL_ANIMATION_MS);
                animate_panel_out(panel, animation_enabled, animation_duration_ms);
                Ok((false, false))
            }
            _ => Err("unsupported panel action".into()),
        }
    }

    pub fn set_pinned(&self, pinned: bool) -> Result<(), String> {
        *self.pinned.lock().map_err(|_| "native panel state unavailable")? = pinned;
        if let Some(panel) = self.panel() {
            // Do not delegate this to hidesOnDeactivate: edge activation starts
            // while another app is active and AppKit can otherwise hide the
            // panel before activation completes. The click monitor checks the
            // pinned flag and owns unpinned dismissal.
            panel.setHidesOnDeactivate(false);
            if pinned {
                panel.setLevel(NSFloatingWindowLevel);
            }
        }
        Ok(())
    }

    /// Install an AppKit global monitor so clicks outside the panel dismiss it.
    /// The panel must remain visible while Edgedor activates across applications,
    /// so this monitor is the single owner of unpinned dismissal behavior.
    pub fn install_dismiss_monitor(&self, app: &AppHandle) -> Result<(), String> {
        if self.dismiss_monitor.lock().map_err(|_| "dismiss monitor state unavailable")?.is_some() {
            return Ok(());
        }
        let panel = self.create()? as *const NSPanel as usize;
        let pinned = self.pinned.clone();
        let width_ratio = self.width_ratio.clone();
        let animation_enabled = self.animation_enabled.clone();
        let animation_duration_ms = self.animation_duration_ms.clone();
        let app = app.clone();
        let block = block2::RcBlock::new(move |_event: std::ptr::NonNull<NSEvent>| {
            if pinned.lock().map(|value| *value).unwrap_or(true) {
                return;
            }
            let panel = unsafe { &*(panel as *const NSPanel) };
            if panel.isVisible() {
                capture_width_ratio(panel, &width_ratio);
                let enabled = animation_enabled.lock().map(|value| *value).unwrap_or(true);
                let duration_ms = animation_duration_ms.lock().map(|value| *value).unwrap_or(DEFAULT_PANEL_ANIMATION_MS);
                animate_panel_out(panel, enabled, duration_ms);
                let _ = app.emit("panel_status", serde_json::json!({"visible": false, "focused": false, "bridgeReady": true}));
            }
        });
        let token = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(
            NSEventMask::LeftMouseDown | NSEventMask::RightMouseDown | NSEventMask::OtherMouseDown,
            &block,
        )
        .ok_or_else(|| "unable to install panel dismiss monitor".to_string())?;
        *self.dismiss_monitor.lock().map_err(|_| "dismiss monitor state unavailable")? =
            Some(RetainedPanel::leak_event_monitor(token));
        Ok(())
    }
}

fn animate_panel_frame(
    panel: &'static NSPanel,
    start: NSRect,
    target: NSRect,
    hide_after: bool,
    enabled: bool,
    duration_ms: u64,
) {
    panel.setFrame_display(start, false);
    if !enabled {
        panel.setFrame_display(target, true);
        if hide_after {
            panel.orderOut(None::<&AnyObject>);
            panel.setLevel(NSNormalWindowLevel);
        }
        return;
    }
    let panel = panel as *const NSPanel as usize;
    let started = Instant::now();
    let duration = duration_ms as f64 / 1000.0;
    let block = block2::RcBlock::new(move |timer: std::ptr::NonNull<NSTimer>| {
        let panel = unsafe { &*(panel as *const NSPanel) };
        let progress = (started.elapsed().as_secs_f64() / duration).clamp(0.0, 1.0);
        let eased = 1.0 - (1.0 - progress).powi(3);
        let frame = NSRect::new(
            NSPoint::new(
                start.origin.x + (target.origin.x - start.origin.x) * eased,
                start.origin.y + (target.origin.y - start.origin.y) * eased,
            ),
            NSSize::new(
                start.size.width + (target.size.width - start.size.width) * eased,
                start.size.height + (target.size.height - start.size.height) * eased,
            ),
        );
        panel.setFrame_display(frame, true);
        if progress >= 1.0 {
            unsafe { timer.as_ref() }.invalidate();
            if hide_after {
                panel.orderOut(None::<&AnyObject>);
                panel.setLevel(NSNormalWindowLevel);
            }
        }
    });
    let _ = unsafe { NSTimer::scheduledTimerWithTimeInterval_repeats_block(1.0 / 60.0, true, &block) };
}

fn animate_panel_out(panel: &'static NSPanel, enabled: bool, duration_ms: u64) {
    if !panel.isVisible() { return; }
    let current = panel.frame();
    let marker = match MainThreadMarker::new() { Some(marker) => marker, None => return };
    let panel_center = NSPoint::new(
        current.origin.x + current.size.width / 2.0,
        current.origin.y + current.size.height / 2.0,
    );
    let screen = screen_at(panel_center, marker).or_else(|| NSScreen::mainScreen(marker));
    let Some(screen) = screen else { panel.orderOut(None::<&AnyObject>); return };
    let frame = screen.visibleFrame();
    let center_x = current.origin.x + current.size.width / 2.0;
    let target_x = if center_x < frame.origin.x + frame.size.width / 2.0 {
        frame.origin.x - current.size.width
    } else {
        frame.origin.x + frame.size.width
    };
    let target = NSRect::new(NSPoint::new(target_x, current.origin.y), current.size);
    animate_panel_frame(panel, current, target, true, enabled, duration_ms);
}

fn saved_width_ratio() -> f64 {
    let ratio = NSUserDefaults::standardUserDefaults().doubleForKey(&NSString::from_str(PANEL_WIDTH_RATIO_KEY));
    if ratio.is_finite() && (0.20..=0.60).contains(&ratio) { ratio } else { 0.35 }
}

fn capture_width_ratio(panel: &NSPanel, width_ratio: &Arc<Mutex<f64>>) {
    let marker = match MainThreadMarker::new() { Some(marker) => marker, None => return };
    let panel_frame = panel.frame();
    let center = NSPoint::new(panel_frame.origin.x + panel_frame.size.width / 2.0, panel_frame.origin.y + panel_frame.size.height / 2.0);
    let Some(screen) = screen_at(center, marker).or_else(|| NSScreen::mainScreen(marker)) else { return };
    let available_width = screen.visibleFrame().size.width;
    if available_width <= 1.0 { return; }
    let ratio = (panel_frame.size.width / available_width).clamp(0.20, 0.60);
    if let Ok(mut stored_ratio) = width_ratio.lock() { *stored_ratio = ratio; }
    NSUserDefaults::standardUserDefaults().setDouble_forKey(ratio, &NSString::from_str(PANEL_WIDTH_RATIO_KEY));
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

    fn leak_status_item(item: objc2::rc::Retained<objc2_app_kit::NSStatusItem>) -> usize {
        objc2::rc::Retained::into_raw(item) as usize
    }

    fn leak_event_monitor(item: objc2::rc::Retained<AnyObject>) -> usize {
        objc2::rc::Retained::into_raw(item) as usize
    }
}

fn screen_at(point: NSPoint, marker: MainThreadMarker) -> Option<objc2::rc::Retained<NSScreen>> {
    let screens = NSScreen::screens(marker);
    (0..screens.count()).find_map(|index| {
        let screen = screens.objectAtIndex(index);
        let frame = screen.frame();
        let within_x = point.x >= frame.origin.x && point.x <= frame.origin.x + frame.size.width;
        let within_y = point.y >= frame.origin.y && point.y <= frame.origin.y + frame.size.height;
        if within_x && within_y { Some(screen) } else { None }
    })
}

pub fn attach_from_setup(app: &AppHandle, state: &NativePanel) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main WebView window not found".to_string())?;
    state.attach(&window)
}

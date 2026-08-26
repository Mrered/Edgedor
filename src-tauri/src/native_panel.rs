//! macOS-only native panel owner.
//!
//! The Tauri window remains the runtime owner of the WebView, while Wry's
//! macOS reparent operation moves that WebView into this retained `NSPanel`.
//! The panel pointer is intentionally kept as an opaque address because
//! AppKit objects are main-thread confined and cannot be put in Tauri state.

use std::sync::{Arc, Mutex};

use objc2::runtime::AnyObject;
use objc2::{sel, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy, NSAutoresizingMaskOptions, NSBackingStoreType, NSEvent, NSEventMask, NSEventModifierFlags, NSMenu, NSMenuItem, NSPanel, NSStatusBar, NSView, NSWindowCollectionBehavior, NSWindowStyleMask, NSWindowTitleVisibility, NSFloatingWindowLevel, NSScreen};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSTimer};
use tauri::{AppHandle, Manager, WebviewWindow};

const PANEL_ANIMATION_MS: u64 = 180;

#[path = "edge_trigger.rs"]
pub mod edge_trigger;

pub struct NativePanel {
    panel: Mutex<Option<usize>>,
    trigger: edge_trigger::EdgeTrigger,
    edge_modifier: Mutex<NSEventModifierFlags>,
    pinned: Arc<Mutex<bool>>,
    status_item: Mutex<Option<usize>>,
    dismiss_monitor: Mutex<Option<usize>>,
}

impl Default for NativePanel {
    fn default() -> Self {
        Self {
            panel: Mutex::new(None),
            trigger: edge_trigger::EdgeTrigger::default(),
            edge_modifier: Mutex::new(NSEventModifierFlags::Command),
            pinned: Arc::new(Mutex::new(false)),
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
        self.trigger.start(edge_trigger::EdgeTriggerConfig { modifier, ..Default::default() }, move |_edge, point| {
            if let Some(panel) = app.try_state::<NativePanel>() {
                if let Err(error) = panel.show_at_edge_at(_edge, point) {
                    eprintln!("Edgedor edge panel show failed: {error}");
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

    pub fn show_at_edge(&self, edge: edge_trigger::Edge) -> Result<(), String> {
        let point = NSEvent::mouseLocation();
        self.show_at_edge_at(edge, (point.x, point.y))
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
        let current_width = panel.frame().size.width;
        let was_visible = panel.isVisible();
        let was_on_active_space = panel.isOnActiveSpace();
        let ratio = if current_width > 1.0 && was_visible && was_on_active_space {
            (current_width / frame.size.width).clamp(0.20, 0.60)
        } else {
            0.35
        };
        let width = (frame.size.width * ratio).clamp(320.0, frame.size.width * 0.60);
        let x = match edge { edge_trigger::Edge::Left => frame.origin.x, edge_trigger::Edge::Right => frame.origin.x + frame.size.width - width };
        let target = NSRect::new(NSPoint::new(x, frame.origin.y), NSSize::new(width, frame.size.height));
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
        animate_panel_frame(panel, start, target, false);
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
        let panel = unsafe {
            NSPanel::initWithContentRect_styleMask_backing_defer(
                NSPanel::alloc(marker),
                NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(800.0, 600.0)),
                style,
                NSBackingStoreType::Buffered,
                false,
            )
        };
        panel.setTitleVisibility(NSWindowTitleVisibility::Hidden);
        panel.setTitlebarAppearsTransparent(true);
        panel.setBecomesKeyOnlyIfNeeded(false);
        panel.setFloatingPanel(true);
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
                panel.orderFrontRegardless();
                panel.makeKeyAndOrderFront(None::<&AnyObject>);
                Ok((true, true))
            }
            "focus" => {
                panel.makeKeyAndOrderFront(None::<&AnyObject>);
                Ok((true, true))
            }
            "hide" => {
                animate_panel_out(panel);
                Ok((false, false))
            }
            _ => Err("unsupported panel action".into()),
        }
    }

    pub fn set_pinned(&self, pinned: bool) -> Result<(), String> {
        *self.pinned.lock().map_err(|_| "native panel state unavailable")? = pinned;
        Ok(())
    }

    /// Install an AppKit global monitor so clicks outside the panel dismiss it.
    /// The panel must remain visible while Edgedor activates across applications,
    /// so this monitor is the single owner of unpinned dismissal behavior.
    pub fn install_dismiss_monitor(&self) -> Result<(), String> {
        if self.dismiss_monitor.lock().map_err(|_| "dismiss monitor state unavailable")?.is_some() {
            return Ok(());
        }
        let panel = self.create()? as *const NSPanel as usize;
        let pinned = self.pinned.clone();
        let block = block2::RcBlock::new(move |_event: std::ptr::NonNull<NSEvent>| {
            if pinned.lock().map(|value| *value).unwrap_or(true) {
                return;
            }
            let panel = unsafe { &*(panel as *const NSPanel) };
            if panel.isVisible() {
                animate_panel_out(panel);
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

fn animate_panel_frame(panel: &'static NSPanel, start: NSRect, target: NSRect, hide_after: bool) {
    panel.setFrame_display(start, false);
    panel.setFrame_display_animate(target, true, true);
    if hide_after {
        let panel = panel as *const NSPanel as usize;
        let block = block2::RcBlock::new(move |_timer: std::ptr::NonNull<NSTimer>| {
            let panel = unsafe { &*(panel as *const NSPanel) };
            panel.orderOut(None::<&AnyObject>);
        });
        let _ = unsafe {
            NSTimer::scheduledTimerWithTimeInterval_repeats_block(
                PANEL_ANIMATION_MS as f64 / 1000.0,
                false,
                &block,
            )
        };
    }
}

fn animate_panel_out(panel: &'static NSPanel) {
    if !panel.isVisible() { return; }
    let current = panel.frame();
    let marker = match MainThreadMarker::new() { Some(marker) => marker, None => return };
    let screen = screen_at(NSEvent::mouseLocation(), marker).or_else(|| NSScreen::mainScreen(marker));
    let Some(screen) = screen else { panel.orderOut(None::<&AnyObject>); return };
    let frame = screen.visibleFrame();
    let center_x = current.origin.x + current.size.width / 2.0;
    let target_x = if center_x < frame.origin.x + frame.size.width / 2.0 {
        frame.origin.x - current.size.width
    } else {
        frame.origin.x + frame.size.width
    };
    let target = NSRect::new(NSPoint::new(target_x, current.origin.y), current.size);
    animate_panel_frame(panel, current, target, true);
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

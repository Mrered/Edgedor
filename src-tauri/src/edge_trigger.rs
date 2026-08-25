//! macOS modifier-plus-edge trigger.
//!
//! This module deliberately owns only the global event monitor. The caller
//! decides what showing or hiding the panel means. AppKit callbacks run on
//! the application main thread; the returned monitor token is retained until
//! [`EdgeTrigger::stop`] or process exit.

use std::sync::{atomic::{AtomicU64, Ordering}, Arc, Mutex};
use std::time::{Duration, Instant};

use block2::RcBlock;
use dispatch2::{DispatchQueue, DispatchTime};
use objc2::runtime::AnyObject;
use objc2::{rc::Retained, MainThreadMarker};
use objc2_app_kit::{NSEvent, NSEventMask, NSEventModifierFlags, NSScreen};
use objc2_foundation::NSPoint;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Edge {
    Left,
    Right,
}

#[derive(Clone, Copy, Debug)]
pub struct EdgeTriggerConfig {
    /// The modifier that must remain pressed while the pointer is at an edge.
    pub modifier: NSEventModifierFlags,
    /// How long the pointer must remain in the edge hit zone.
    pub hold_duration: Duration,
    /// Hit-zone width in AppKit points.
    pub edge_tolerance: f64,
}

impl Default for EdgeTriggerConfig {
    fn default() -> Self {
        Self {
            modifier: NSEventModifierFlags::Command,
            hold_duration: Duration::from_millis(150),
            edge_tolerance: 3.0,
        }
    }
}

#[derive(Default)]
struct TriggerState {
    edge: Option<Edge>,
    edge_since: Option<Instant>,
    fired: bool,
}

pub struct EdgeTrigger {
    monitor: Mutex<Option<usize>>,
    epoch: Arc<AtomicU64>,
}

impl Default for EdgeTrigger {
    fn default() -> Self {
        Self {
            monitor: Mutex::new(None),
            epoch: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl EdgeTrigger {
    /// Installs one global mouse/flags monitor. Calling this twice is a no-op.
    /// The callback is invoked once after the configured hold duration and is
    /// re-armed only after leaving the edge or releasing the modifier.
    pub fn start<F>(&self, config: EdgeTriggerConfig, callback: F) -> Result<(), String>
    where
        F: Fn(Edge) + Send + Sync + 'static,
    {
        if config.modifier.is_empty() {
            return Err("edge trigger modifier cannot be empty".to_string());
        }
        let run_id = self.epoch.fetch_add(1, Ordering::AcqRel).wrapping_add(1);
        let epoch = Arc::clone(&self.epoch);
        let mut monitor = self
            .monitor
            .lock()
            .map_err(|_| "edge trigger state unavailable")?;
        if monitor.is_some() {
            return Ok(());
        }

        let state = Arc::new(Mutex::new(TriggerState::default()));
        let callback: Arc<dyn Fn(Edge) + Send + Sync> = Arc::new(callback);
        let block_state = Arc::clone(&state);
        let block_callback = Arc::clone(&callback);
        let block = RcBlock::new(move |_event: std::ptr::NonNull<NSEvent>| {
            let marker = match MainThreadMarker::new() {
                Some(marker) => marker,
                None => return,
            };
            let flags = NSEvent::modifierFlags_class();
            let modifier_down = flags.contains(config.modifier);
            let edge = if modifier_down {
                edge_at(NSEvent::mouseLocation(), config.edge_tolerance, marker)
            } else {
                None
            };
            let mut state = match block_state.lock() {
                Ok(state) => state,
                Err(_) => return,
            };
            let Some(edge) = edge else {
                state.edge = None;
                state.edge_since = None;
                state.fired = false;
                return;
            };
            if state.edge != Some(edge) {
                state.edge = Some(edge);
                state.edge_since = Some(Instant::now());
                state.fired = false;
                let timer_state = Arc::clone(&block_state);
                let timer_callback = Arc::clone(&block_callback);
                let timer_epoch = Arc::clone(&epoch);
                let timer_edge = edge;
                let timer_delay = config.hold_duration;
                if let Ok(delay) = i64::try_from(timer_delay.as_nanos()) {
                    let _ = DispatchQueue::main().after(
                        DispatchTime::NOW.time(delay),
                        move || {
                            let mut state = match timer_state.lock() {
                                Ok(state) => state,
                                Err(_) => return,
                            };
                            if timer_epoch.load(Ordering::Acquire) == run_id
                                && state.edge == Some(timer_edge)
                                && !state.fired
                                && state.edge_since.is_some_and(|since| since.elapsed() >= timer_delay)
                            {
                                state.fired = true;
                                timer_callback(timer_edge);
                            }
                        },
                    );
                }
                return;
            }
            if !state.fired
                && state
                    .edge_since
                    .is_some_and(|since| since.elapsed() >= config.hold_duration)
            {
                state.fired = true;
                block_callback(edge);
            }
        });

        let token = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(
            NSEventMask::MouseMoved | NSEventMask::FlagsChanged,
            &block,
        )
        .ok_or_else(|| {
            "unable to install NSEvent global monitor; grant Accessibility/Input Monitoring permission"
                .to_string()
        })?;
        *monitor = Some(Retained::into_raw(token) as usize);
        Ok(())
    }

    /// Removes the global monitor. Safe to call repeatedly.
    pub fn stop(&self) {
        let Ok(mut monitor) = self.monitor.lock() else {
            return;
        };
        let Some(pointer) = monitor.take() else {
            self.epoch.fetch_add(1, Ordering::AcqRel);
            return;
        };
        self.epoch.fetch_add(1, Ordering::AcqRel);
        let token = unsafe { &*(pointer as *const AnyObject) };
        unsafe { NSEvent::removeMonitor(token) };
        unsafe { drop(Retained::from_raw(pointer as *mut AnyObject)) };
    }
}

pub fn modifier_flags(name: &str) -> Result<NSEventModifierFlags, String> {
    match name.trim().to_ascii_lowercase().as_str() {
        "command" | "cmd" => Ok(NSEventModifierFlags::Command),
        "option" | "alt" => Ok(NSEventModifierFlags::Option),
        "control" | "ctrl" => Ok(NSEventModifierFlags::Control),
        "shift" => Ok(NSEventModifierFlags::Shift),
        _ => Err("unsupported edge modifier; use command, option, control, or shift".to_string()),
    }
}

impl Drop for EdgeTrigger {
    fn drop(&mut self) {
        self.stop();
    }
}

fn edge_at(point: NSPoint, tolerance: f64, marker: MainThreadMarker) -> Option<Edge> {
    let screens = NSScreen::screens(marker);
    for index in 0..screens.count() {
        let screen = screens.objectAtIndex(index);
        let frame = screen.frame();
        let in_vertical_range = point.y >= frame.origin.y && point.y <= frame.origin.y + frame.size.height;
        if !in_vertical_range {
            continue;
        }
        if point.x >= frame.origin.x && point.x <= frame.origin.x + tolerance {
            return Some(Edge::Left);
        }
        let right = frame.origin.x + frame.size.width;
        if point.x <= right && point.x >= right - tolerance {
            return Some(Edge::Right);
        }
    }
    None
}

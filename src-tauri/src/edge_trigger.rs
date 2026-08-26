//! macOS modifier-plus-edge trigger.
//!
//! This module polls AppKit's current pointer and modifier state on the main
//! run loop. The caller decides what showing or hiding the panel means. The
//! timer is retained until [`EdgeTrigger::stop`] or process exit.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use block2::RcBlock;
use objc2::{rc::Retained, MainThreadMarker};
use objc2_app_kit::{NSEvent, NSEventModifierFlags, NSScreen};
use objc2_foundation::{NSPoint, NSTimer};

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
    timer: Mutex<Option<usize>>,
}

impl Default for EdgeTrigger {
    fn default() -> Self {
        Self {
            timer: Mutex::new(None),
        }
    }
}

impl EdgeTrigger {
    /// Installs one main-run-loop poller. Calling this twice is a no-op.
    /// The callback is invoked once after the configured hold duration and is
    /// re-armed only after leaving the edge or releasing the modifier.
    pub fn start<F>(&self, config: EdgeTriggerConfig, callback: F) -> Result<(), String>
    where
        F: Fn(Edge) + Send + Sync + 'static,
    {
        if config.modifier.is_empty() {
            return Err("edge trigger modifier cannot be empty".to_string());
        }
        MainThreadMarker::new().ok_or("edge trigger must start on the main thread")?;
        let mut timer = self
            .timer
            .lock()
            .map_err(|_| "edge trigger state unavailable")?;
        if timer.is_some() {
            return Ok(());
        }

        let state = Arc::new(Mutex::new(TriggerState::default()));
        let callback: Arc<dyn Fn(Edge) + Send + Sync> = Arc::new(callback);
        let block_state = Arc::clone(&state);
        let block_callback = Arc::clone(&callback);
        let block = RcBlock::new(move |_timer: std::ptr::NonNull<NSTimer>| {
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

        let polling_timer = unsafe {
            NSTimer::scheduledTimerWithTimeInterval_repeats_block(1.0 / 60.0, true, &block)
        };
        polling_timer.setTolerance(1.0 / 240.0);
        *timer = Some(Retained::into_raw(polling_timer) as usize);
        eprintln!("Edgedor edge trigger poller started");
        Ok(())
    }

    /// Stops the poller. Safe to call repeatedly.
    pub fn stop(&self) {
        let Ok(mut timer) = self.timer.lock() else {
            return;
        };
        let Some(pointer) = timer.take() else {
            return;
        };
        let Some(timer) = (unsafe { Retained::from_raw(pointer as *mut NSTimer) }) else {
            return;
        };
        timer.invalidate();
        drop(timer);
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExitDecision {
    Allow,
    AllowFallback(ExitFallbackReason),
    PreventAndRequestCheckpoint,
    Prevent,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExitFallbackReason {
    ListenerUnavailable,
    CheckpointUnconfirmed,
}

pub const MAX_BLOCKED_EXIT_ATTEMPTS: u8 = 3;

#[derive(Debug, Default)]
pub struct ShutdownState {
    normal_exit_pending: bool,
    listener_ready: bool,
    request_delivered: bool,
    exit_confirmed: bool,
    blocked_exit_attempts: u8,
    delivery_attempts: u8,
}

impl ShutdownState {
    pub fn exit_requested(&mut self, code: Option<i32>) -> ExitDecision {
        if code == Some(tauri::RESTART_EXIT_CODE) || self.exit_confirmed {
            return ExitDecision::Allow;
        }

        self.normal_exit_pending = true;
        self.blocked_exit_attempts = self.blocked_exit_attempts.saturating_add(1);
        if self.blocked_exit_attempts >= MAX_BLOCKED_EXIT_ATTEMPTS {
            let reason = if self.listener_ready {
                ExitFallbackReason::CheckpointUnconfirmed
            } else {
                ExitFallbackReason::ListenerUnavailable
            };
            return ExitDecision::AllowFallback(reason);
        }

        if self.listener_ready {
            self.request_delivered = true;
            self.delivery_attempts = self.delivery_attempts.saturating_add(1);
            return ExitDecision::PreventAndRequestCheckpoint;
        }
        ExitDecision::Prevent
    }

    pub fn mark_listener_ready(&mut self) -> bool {
        self.listener_ready = true;
        if self.normal_exit_pending
            && !self.request_delivered
            && self.blocked_exit_attempts < MAX_BLOCKED_EXIT_ATTEMPTS
        {
            self.request_delivered = true;
            self.delivery_attempts = self.delivery_attempts.saturating_add(1);
            return true;
        }
        false
    }

    pub fn delivery_failed(&mut self) {
        self.request_delivered = false;
    }

    pub fn confirm_exit(&mut self) {
        self.exit_confirmed = true;
    }
}

#[cfg(test)]
mod tests {
    use super::{ExitDecision, ShutdownState};

    #[test]
    fn restart_exit_code_is_always_allowed() {
        let mut state = ShutdownState::default();
        assert_eq!(state.exit_requested(None), ExitDecision::Prevent);
        for _ in 0..=3 {
            assert_eq!(state.exit_requested(Some(tauri::RESTART_EXIT_CODE)), ExitDecision::Allow);
        }
        state.mark_listener_ready();
        assert_eq!(state.exit_requested(None), ExitDecision::PreventAndRequestCheckpoint);
    }

    #[test]
    fn first_normal_exit_requests_one_checkpoint() {
        let mut state = ShutdownState::default();
        assert!(!state.mark_listener_ready());
        assert_eq!(
            state.exit_requested(None),
            ExitDecision::PreventAndRequestCheckpoint
        );
    }

    #[test]
    fn emit_failure_can_be_retried() {
        let mut state = ShutdownState::default();
        assert!(!state.mark_listener_ready());
        assert_eq!(
            state.exit_requested(None),
            ExitDecision::PreventAndRequestCheckpoint
        );
        state.delivery_failed();
        assert_eq!(state.exit_requested(None), ExitDecision::PreventAndRequestCheckpoint);
    }

    #[test]
    fn confirmed_normal_exit_is_allowed() {
        let mut state = ShutdownState::default();
        state.confirm_exit();
        assert_eq!(state.exit_requested(Some(0)), ExitDecision::Allow);
    }

    #[test]
    fn early_exit_is_delivered_once_when_listener_becomes_ready() {
        let mut state = ShutdownState::default();
        assert_eq!(state.exit_requested(None), ExitDecision::Prevent);
        assert!(state.mark_listener_ready());
        assert!(!state.mark_listener_ready());
    }

    #[test]
    fn unconfirmed_delivery_never_allows_fallback() {
        let mut state = ShutdownState::default();
        state.mark_listener_ready();
        for _ in 0..10 {
            assert_eq!(state.exit_requested(None), ExitDecision::PreventAndRequestCheckpoint);
        }
    }

    #[test]
    fn missing_listener_never_allows_fallback() {
        let mut state = ShutdownState::default();
        for _ in 0..10 {
            assert_eq!(state.exit_requested(None), ExitDecision::Prevent);
        }
    }

    #[test]
    fn cancelled_checkpoint_can_be_requested_again() {
        let mut state = ShutdownState::default();
        state.mark_listener_ready();
        assert_eq!(state.exit_requested(None), ExitDecision::PreventAndRequestCheckpoint);
        state.cancel_request();
        assert_eq!(state.exit_requested(None), ExitDecision::PreventAndRequestCheckpoint);
    }

    #[test]
    fn repeated_confirmation_is_idempotent() {
        let mut state = ShutdownState::default();
        state.confirm_exit();
        state.confirm_exit();
        assert_eq!(state.exit_requested(None), ExitDecision::Allow);
    }
}

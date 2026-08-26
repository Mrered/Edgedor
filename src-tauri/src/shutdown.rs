#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExitDecision {
    Allow,
    PreventAndRequestCheckpoint,
    Prevent,
}

#[derive(Debug, Default)]
pub struct ShutdownState {
    normal_exit_pending: bool,
    listener_ready: bool,
    request_delivered: bool,
    exit_confirmed: bool,
}

impl ShutdownState {
    pub fn exit_requested(&mut self, code: Option<i32>) -> ExitDecision {
        if code == Some(tauri::RESTART_EXIT_CODE) || self.exit_confirmed {
            return ExitDecision::Allow;
        }
        self.normal_exit_pending = true;
        if self.listener_ready && !self.request_delivered {
            self.request_delivered = true;
            return ExitDecision::PreventAndRequestCheckpoint;
        }
        ExitDecision::Prevent
    }

    pub fn mark_listener_ready(&mut self) -> bool {
        self.listener_ready = true;
        if self.normal_exit_pending && !self.request_delivered {
            self.request_delivered = true;
            return true;
        }
        false
    }

    pub fn confirm_exit(&mut self) {
        self.exit_confirmed = true;
    }
}

#[cfg(test)]
mod tests {
    use super::{ExitDecision, ExitFallbackReason, ShutdownState, MAX_BLOCKED_EXIT_ATTEMPTS};

    #[test]
    fn restart_exit_code_is_always_allowed() {
        let mut state = ShutdownState::default();
        assert_eq!(state.exit_requested(None), ExitDecision::Prevent);
        for _ in 0..=MAX_BLOCKED_EXIT_ATTEMPTS {
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
    fn unconfirmed_delivery_retries_then_allows_fallback() {
        let mut state = ShutdownState::default();
        state.mark_listener_ready();
        for _ in 1..MAX_BLOCKED_EXIT_ATTEMPTS {
            assert_eq!(state.exit_requested(None), ExitDecision::PreventAndRequestCheckpoint);
        }
        assert_eq!(
            state.exit_requested(None),
            ExitDecision::AllowFallback(ExitFallbackReason::CheckpointUnconfirmed)
        );
    }

    #[test]
    fn missing_listener_eventually_allows_fallback() {
        let mut state = ShutdownState::default();
        for _ in 1..MAX_BLOCKED_EXIT_ATTEMPTS {
            assert_eq!(state.exit_requested(None), ExitDecision::Prevent);
        }
        assert_eq!(
            state.exit_requested(None),
            ExitDecision::AllowFallback(ExitFallbackReason::ListenerUnavailable)
        );
    }

    #[test]
    fn repeated_confirmation_is_idempotent() {
        let mut state = ShutdownState::default();
        state.confirm_exit();
        state.confirm_exit();
        assert_eq!(state.exit_requested(None), ExitDecision::Allow);
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExitDecision {
    Allow,
    PreventAndRequestCheckpoint,
    Prevent,
}

#[derive(Debug, Default)]
pub struct ShutdownState {
    checkpoint_requested: bool,
    exit_confirmed: bool,
}

impl ShutdownState {
    pub fn exit_requested(&mut self, code: Option<i32>) -> ExitDecision {
        if code == Some(tauri::RESTART_EXIT_CODE) || self.exit_confirmed {
            return ExitDecision::Allow;
        }
        if self.checkpoint_requested {
            return ExitDecision::Prevent;
        }
        self.checkpoint_requested = true;
        ExitDecision::PreventAndRequestCheckpoint
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
        assert_eq!(
            state.exit_requested(None),
            ExitDecision::PreventAndRequestCheckpoint
        );
        assert_eq!(
            state.exit_requested(Some(tauri::RESTART_EXIT_CODE)),
            ExitDecision::Allow
        );
    }

    #[test]
    fn first_normal_exit_requests_one_checkpoint() {
        let mut state = ShutdownState::default();
        assert_eq!(
            state.exit_requested(None),
            ExitDecision::PreventAndRequestCheckpoint
        );
    }

    #[test]
    fn repeated_normal_exit_waits_without_requesting_again() {
        let mut state = ShutdownState::default();
        assert_eq!(
            state.exit_requested(None),
            ExitDecision::PreventAndRequestCheckpoint
        );
        assert_eq!(state.exit_requested(None), ExitDecision::Prevent);
    }

    #[test]
    fn confirmed_normal_exit_is_allowed() {
        let mut state = ShutdownState::default();
        state.confirm_exit();
        assert_eq!(state.exit_requested(Some(0)), ExitDecision::Allow);
    }
}

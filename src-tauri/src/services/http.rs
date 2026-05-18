//! Shared reqwest client + transient OS error detection.
//!
//! All provider services route HTTP through `shared_http_client()` so we keep a
//! single bounded connection pool. Default reqwest pool size is unbounded, which
//! combined with 4 services polling on independent timers used to push the
//! per-process FD count uncomfortably close to the macOS 256 soft limit.

use std::sync::OnceLock;
use std::time::Duration;

pub fn shared_http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        match reqwest::Client::builder()
            .pool_max_idle_per_host(4)
            .pool_idle_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(10))
            .build()
        {
            Ok(client) => client,
            Err(err) => {
                eprintln!("[HTTP] failed to build shared reqwest client: {err}");
                reqwest::Client::new()
            }
        }
    })
}

/// Recognize transient OS errors that should not surface to the UI:
/// EMFILE (24), ENFILE (23), EAGAIN (35 on macOS, 11 on linux), EWOULDBLOCK.
/// These typically clear themselves within one poll cycle as the kernel
/// reclaims descriptors / restarts blocked syscalls.
pub fn is_transient_os_error(message: &str) -> bool {
    message.contains("os error 24")
        || message.contains("os error 23")
        || message.contains("os error 35")
        || message.contains("os error 11")
        || message.contains("Too many open files")
        || message.contains("Resource temporarily unavailable")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_emfile_messages() {
        assert!(is_transient_os_error(
            "Failed to read auth.json: Too many open files (os error 24)"
        ));
        assert!(is_transient_os_error("Network error: os error 35"));
    }

    #[test]
    fn rejects_other_errors() {
        assert!(!is_transient_os_error("API error: 429 Too Many Requests"));
        assert!(!is_transient_os_error("Token expired"));
        assert!(!is_transient_os_error("Network error: os error 60")); // ETIMEDOUT
    }
}

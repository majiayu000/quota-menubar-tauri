//! Antigravity placeholder.
//!
//! Antigravity (Google) is in public preview and the only quota field exposed by
//! `fetchAvailableModels` reflects the 5-hour sprint window, which the community
//! has confirmed is decoupled from real rate limiting (a separate weekly baseline
//! gates users earlier). To avoid showing misleading data, we keep this provider
//! as a placeholder until Google ships a stable usage API (expected with the
//! paid tier in 2026).

use crate::domain::models::AntigravityData;

pub async fn fetch_antigravity_info() -> AntigravityData {
    AntigravityData::placeholder()
}

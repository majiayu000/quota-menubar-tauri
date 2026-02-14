use crate::domain::models::{QuotaData, UsageInfo};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const TOKEN_CACHE_TTL: Duration = Duration::from_secs(300);

#[derive(Clone)]
struct CachedToken {
    value: String,
    cached_at: Instant,
}

static TOKEN_CACHE: OnceLock<Mutex<Option<CachedToken>>> = OnceLock::new();

fn token_cache() -> &'static Mutex<Option<CachedToken>> {
    TOKEN_CACHE.get_or_init(|| Mutex::new(None))
}

fn claude_http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn read_oauth_token_from_keychain() -> Result<String, String> {
    let credential_names = [
        "Claude Code-credentials",
        "claude-credentials",
        "Claude-credentials",
        "claudecode-credentials",
    ];

    for cred_name in credential_names {
        let output = Command::new("security")
            .args(["find-generic-password", "-s", cred_name, "-w"])
            .output();

        if let Ok(result) = output {
            if result.status.success() {
                let creds_json = String::from_utf8_lossy(&result.stdout).trim().to_string();
                if creds_json.is_empty() {
                    continue;
                }

                if let Ok(creds) = serde_json::from_str::<serde_json::Value>(&creds_json) {
                    if let Some(token) = creds["claudeAiOauth"]["accessToken"].as_str() {
                        return Ok(token.to_string());
                    }
                }
            }
        }
    }

    Err("OAuth token not found. Please ensure you are logged into Claude Code.".to_string())
}

fn get_oauth_token(force_refresh: bool) -> Result<String, String> {
    if !force_refresh {
        if let Ok(guard) = token_cache().lock() {
            if let Some(token) = guard.as_ref() {
                if token.cached_at.elapsed() < TOKEN_CACHE_TTL {
                    return Ok(token.value.clone());
                }
            }
        }
    }

    let fresh_token = read_oauth_token_from_keychain()?;
    if let Ok(mut guard) = token_cache().lock() {
        *guard = Some(CachedToken {
            value: fresh_token.clone(),
            cached_at: Instant::now(),
        });
    }
    Ok(fresh_token)
}

async fn request_quota(access_token: &str) -> Result<reqwest::Response, String> {
    claude_http_client()
        .get("https://api.anthropic.com/api/oauth/usage")
        .header("Accept", "application/json")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("anthropic-beta", "oauth-2025-04-20")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|err| format!("Network error: {err}"))
}

fn is_auth_error(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN
}

fn parse_quota_window(value: &serde_json::Value) -> Option<UsageInfo> {
    if value.is_null() || !value.is_object() {
        return None;
    }

    let utilization = value["utilization"].as_f64().unwrap_or(0.0);
    let resets_at = value["resets_at"].as_str().map(ToString::to_string);

    Some(UsageInfo {
        used: utilization,
        limit: 100.0,
        percentage: utilization,
        reset_time: resets_at,
    })
}

pub async fn fetch_quota() -> QuotaData {
    let mut access_token = match get_oauth_token(false) {
        Ok(token) => token,
        Err(error) => return QuotaData::disconnected(error),
    };

    let mut response = match request_quota(&access_token).await {
        Ok(resp) => resp,
        Err(error) => return QuotaData::disconnected(error),
    };

    if is_auth_error(response.status()) {
        access_token = match get_oauth_token(true) {
            Ok(token) => token,
            Err(error) => return QuotaData::disconnected(error),
        };

        response = match request_quota(&access_token).await {
            Ok(resp) => resp,
            Err(error) => return QuotaData::disconnected(error),
        };

        if is_auth_error(response.status()) {
            return QuotaData::disconnected("Token expired. Please re-login to Claude Code.");
        }
    }

    if !response.status().is_success() {
        return QuotaData::disconnected(format!("API error: {}", response.status()));
    }

    let data = match response.json::<serde_json::Value>().await {
        Ok(data) => data,
        Err(err) => return QuotaData::disconnected(format!("Failed to parse response: {err}")),
    };

    if data["error"].is_object() {
        let error_msg = data["error"]["message"].as_str().unwrap_or("API error");
        return QuotaData::disconnected(format!("{error_msg} (Token may be expired)"));
    }

    QuotaData::connected(
        parse_quota_window(&data["five_hour"]),
        parse_quota_window(&data["seven_day"]),
        parse_quota_window(&data["seven_day_opus"]),
        parse_quota_window(&data["seven_day_sonnet"]),
    )
}

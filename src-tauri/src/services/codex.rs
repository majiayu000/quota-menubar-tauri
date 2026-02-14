use crate::domain::models::{
    CodexCredits, CodexData, CodexRateLimitWindow, CodexRateLimits, CodexStats,
};
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};
use chrono::{DateTime, Utc};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

fn get_codex_home() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".codex"))
}

fn decode_jwt_payload(token: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    let payload = parts[1];
    let padded = match payload.len() % 4 {
        2 => format!("{payload}=="),
        3 => format!("{payload}="),
        _ => payload.to_string(),
    };
    let standard = padded.replace('-', "+").replace('_', "/");

    STANDARD_NO_PAD
        .decode(&standard)
        .ok()
        .or_else(|| base64::engine::general_purpose::STANDARD.decode(&standard).ok())
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .and_then(|json| serde_json::from_str(&json).ok())
}

fn read_auth_json() -> Result<serde_json::Value, String> {
    let codex_home = get_codex_home().ok_or_else(|| "Could not find home directory".to_string())?;
    let auth_file = codex_home.join("auth.json");
    if !auth_file.exists() {
        return Err("Codex not configured. Please run 'codex' to login.".to_string());
    }

    let content = fs::read_to_string(&auth_file)
        .map_err(|e| format!("Failed to read auth.json: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse auth.json: {e}"))
}

fn parse_used_percent(window: &serde_json::Value) -> f64 {
    let value = window["used_percent"]
        .as_f64()
        .or_else(|| window["used_percent"].as_i64().map(|v| v as f64))
        .unwrap_or(0.0);
    value.clamp(0.0, 100.0)
}

fn parse_rate_limit_window(window: &serde_json::Value) -> Option<CodexRateLimitWindow> {
    if window.is_null() || !window.is_object() {
        return None;
    }

    Some(CodexRateLimitWindow {
        used_percent: parse_used_percent(window),
        window_minutes: window["limit_window_seconds"].as_i64().map(|s| (s + 59) / 60),
        resets_at: window["reset_at"].as_i64(),
    })
}

pub async fn fetch_codex_info() -> CodexData {
    let auth_json = match read_auth_json() {
        Ok(v) => v,
        Err(error) => return CodexData::disconnected(error),
    };

    let id_token = match auth_json["tokens"]["id_token"].as_str() {
        Some(token) => token,
        None => return CodexData::disconnected("No id_token found in auth.json"),
    };

    let payload = match decode_jwt_payload(id_token) {
        Some(payload) => payload,
        None => return CodexData::disconnected("Failed to decode JWT token"),
    };

    let auth_info = &payload["https://api.openai.com/auth"];

    CodexData {
        connected: true,
        plan_type: auth_info["chatgpt_plan_type"].as_str().map(ToString::to_string),
        account_id: auth_info["chatgpt_account_id"].as_str().map(ToString::to_string),
        subscription_until: auth_info["chatgpt_subscription_active_until"]
            .as_str()
            .map(ToString::to_string),
        email: payload["email"].as_str().map(ToString::to_string),
        error: None,
    }
}

pub async fn fetch_codex_stats() -> CodexStats {
    let codex_home = match get_codex_home() {
        Some(path) => path,
        None => return CodexStats::empty(),
    };

    let history_file = codex_home.join("history.jsonl");
    if !history_file.exists() {
        return CodexStats::empty();
    }

    let file = match fs::File::open(&history_file) {
        Ok(file) => file,
        Err(_) => return CodexStats::empty(),
    };

    let reader = BufReader::new(file);
    let today = Utc::now().date_naive();
    let mut total_sessions = 0u32;
    let mut today_sessions = 0u32;
    let mut last_ts: Option<i64> = None;

    for line in reader.lines().map_while(Result::ok) {
        if let Ok(entry) = serde_json::from_str::<serde_json::Value>(&line) {
            total_sessions += 1;
            if let Some(ts) = entry["ts"].as_i64() {
                if let Some(dt) = DateTime::from_timestamp(ts, 0) {
                    if dt.date_naive() == today {
                        today_sessions += 1;
                    }
                }

                if last_ts.is_none_or(|current| ts > current) {
                    last_ts = Some(ts);
                }
            }
        }
    }

    let last_activity = last_ts
        .and_then(|ts| DateTime::from_timestamp(ts, 0))
        .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string());

    CodexStats {
        total_sessions,
        today_sessions,
        last_activity,
    }
}

pub async fn fetch_codex_rate_limits() -> CodexRateLimits {
    let auth_json = match read_auth_json() {
        Ok(v) => v,
        Err(error) => return CodexRateLimits::disconnected(error),
    };

    let access_token = match auth_json["tokens"]["access_token"].as_str() {
        Some(token) => token,
        None => return CodexRateLimits::disconnected("No access_token found in auth.json"),
    };

    let account_id = auth_json["tokens"]["id_token"]
        .as_str()
        .and_then(decode_jwt_payload)
        .and_then(|payload| {
            payload["https://api.openai.com/auth"]["chatgpt_account_id"]
                .as_str()
                .map(ToString::to_string)
        });

    let client = reqwest::Client::new();
    let mut request = client
        .get("https://chatgpt.com/backend-api/wham/usage")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("User-Agent", "codex-cli")
        .timeout(std::time::Duration::from_secs(10));

    if let Some(account_id) = account_id {
        request = request.header("ChatGPT-Account-Id", account_id);
    }

    let response = match request.send().await {
        Ok(resp) => resp,
        Err(err) => return CodexRateLimits::disconnected(format!("Network error: {err}")),
    };

    if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
        return CodexRateLimits::disconnected("Token expired. Please run 'codex' to re-login.");
    }

    if !response.status().is_success() {
        return CodexRateLimits::disconnected(format!("API error: {}", response.status()));
    }

    let data = match response.json::<serde_json::Value>().await {
        Ok(data) => data,
        Err(err) => return CodexRateLimits::disconnected(format!("Failed to parse response: {err}")),
    };

    let primary = data["rate_limit"]
        .get("primary_window")
        .and_then(parse_rate_limit_window);

    let secondary = data["rate_limit"]
        .get("secondary_window")
        .and_then(parse_rate_limit_window);

    let credits = data["credits"].as_object().map(|credits| CodexCredits {
        has_credits: credits
            .get("has_credits")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        unlimited: credits
            .get("unlimited")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        balance: credits
            .get("balance")
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
    });

    CodexRateLimits {
        connected: true,
        plan_type: data["plan_type"].as_str().map(ToString::to_string),
        primary,
        secondary,
        credits,
        error: None,
    }
}

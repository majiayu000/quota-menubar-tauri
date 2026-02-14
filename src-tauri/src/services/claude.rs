use crate::domain::models::{QuotaData, UsageInfo};
use std::process::Command;

fn get_oauth_token() -> Result<String, String> {
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
    let access_token = match get_oauth_token() {
        Ok(token) => token,
        Err(error) => return QuotaData::disconnected(error),
    };

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.anthropic.com/api/oauth/usage")
        .header("Accept", "application/json")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("anthropic-beta", "oauth-2025-04-20")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    let response = match response {
        Ok(resp) => resp,
        Err(err) => return QuotaData::disconnected(format!("Network error: {err}")),
    };

    if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
        return QuotaData::disconnected("Token expired. Please re-login to Claude Code.");
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

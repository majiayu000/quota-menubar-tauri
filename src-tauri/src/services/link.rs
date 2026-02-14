pub fn open_claude_dashboard() -> Result<(), String> {
    tauri_plugin_opener::open_url("https://console.anthropic.com/settings/usage", None::<&str>)
        .map_err(|e| e.to_string())
}

pub fn open_codex_dashboard() -> Result<(), String> {
    tauri_plugin_opener::open_url("https://chatgpt.com", None::<&str>)
        .map_err(|e| e.to_string())
}

use std::sync::{mpsc, Mutex};

use super::{link, tray_icon};
use crate::domain::models::TrayDisplayData;
use chrono::Local;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIconId},
    AppHandle, Emitter, Manager, Position, State, Wry,
};

const TRAY_SHOW_OVERVIEW_EVENT: &str = "tray://show-overview";
const TRAY_REFRESH_ALL_EVENT: &str = "tray://refresh-all";

const MENU_ID_STATUS_CLAUDE: &str = "status_claude";
const MENU_ID_STATUS_CODEX: &str = "status_codex";
const MENU_ID_OPEN_OVERVIEW: &str = "open_overview";
const MENU_ID_REFRESH_ALL: &str = "refresh_all";
const MENU_ID_OPEN_CLAUDE_DASHBOARD: &str = "open_claude_dashboard";
const MENU_ID_OPEN_CODEX_DASHBOARD: &str = "open_codex_dashboard";
const MENU_ID_QUIT: &str = "quit";

#[derive(Clone)]
struct TrayMenuHandles {
    claude_status: MenuItem<Wry>,
    codex_status: MenuItem<Wry>,
}

pub struct TrayState {
    pub tray_id: Mutex<Option<TrayIconId>>,
    menu_handles: Mutex<Option<TrayMenuHandles>>,
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            tray_id: Mutex::new(None),
            menu_handles: Mutex::new(None),
        }
    }
}

fn find_monitor_at_point(app: &AppHandle, x: i32, y: i32) -> Option<tauri::Monitor> {
    let monitors = app.available_monitors().ok()?;
    for monitor in monitors {
        let pos = monitor.position();
        let size = monitor.size();
        let mx = pos.x;
        let my = pos.y;
        let mw = size.width as i32;
        let mh = size.height as i32;
        if x >= mx && x < mx + mw && y >= my && y < my + mh {
            return Some(monitor);
        }
    }
    None
}

fn position_window_near_tray(app: &AppHandle, tray: &tauri::tray::TrayIcon) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let Ok(Some(rect)) = tray.rect() else {
        return;
    };

    let Ok(window_size) = window.outer_size() else {
        return;
    };

    let pos = match rect.position {
        Position::Physical(p) => (p.x, p.y),
        Position::Logical(l) => (l.x as i32, l.y as i32),
    };

    let tray_size = match rect.size {
        tauri::Size::Physical(s) => (s.width, s.height),
        tauri::Size::Logical(l) => (l.width as u32, l.height as u32),
    };

    let window_width = window_size.width as i32;
    let window_height = window_size.height as i32;
    let tray_center_x = pos.0 + (tray_size.0 as i32 / 2);

    let mut x = tray_center_x - (window_width / 2);
    let mut y = pos.1 + tray_size.1 as i32 + 8;

    if let Some(monitor) = find_monitor_at_point(app, pos.0, pos.1) {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let screen_x = monitor_pos.x;
        let screen_y = monitor_pos.y;
        let screen_width = monitor_size.width as i32;
        let screen_height = monitor_size.height as i32;

        if pos.1 - screen_y > screen_height / 2 {
            y = pos.1 - window_height - 8;
        }

        let min_x = screen_x;
        let max_x = (screen_x + screen_width - window_width).max(screen_x);
        let min_y = screen_y;
        let max_y = (screen_y + screen_height - window_height).max(screen_y);
        x = x.clamp(min_x, max_x);
        y = y.clamp(min_y, max_y);
    }

    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
}

fn emit_overview_event(app: &AppHandle) {
    let _ = app.emit(TRAY_SHOW_OVERVIEW_EVENT, ());
}

fn emit_refresh_event(app: &AppHandle) {
    let _ = app.emit(TRAY_REFRESH_ALL_EVENT, ());
}

fn show_overview_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        emit_overview_event(app);
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn compact_value(connected: bool, percentage: Option<u8>) -> String {
    if connected {
        percentage
            .map(|value| value.min(100).to_string())
            .unwrap_or_else(|| "--".to_string())
    } else {
        "--".to_string()
    }
}

fn format_tray_title(payload: &TrayDisplayData) -> String {
    let claude = compact_value(payload.claude_connected, payload.claude_percentage);
    let codex = compact_value(payload.codex_connected, payload.codex_percentage);

    if claude == "--" && codex == "--" {
        "--".to_string()
    } else {
        format!("{claude}/{codex}")
    }
}

fn format_service_line(label: &str, connected: bool, percentage: Option<u8>) -> String {
    if !connected {
        return format!("{label}: unavailable");
    }

    if let Some(percentage) = percentage {
        format!("{label}: {}% used", percentage.min(100))
    } else {
        format!("{label}: connected")
    }
}

fn format_tooltip(payload: &TrayDisplayData, updated_at: &str) -> String {
    let claude = format_service_line(
        "Claude Code",
        payload.claude_connected,
        payload.claude_percentage,
    );
    let codex = format_service_line("Codex", payload.codex_connected, payload.codex_percentage);

    format!("Quota Menubar\n{claude}\n{codex}\nUpdated: {updated_at}\nClick to open overview")
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let claude_status_item = MenuItemBuilder::with_id(
        MENU_ID_STATUS_CLAUDE,
        "Claude Code: unavailable",
    )
    .enabled(false)
    .build(app)?;
    let codex_status_item =
        MenuItemBuilder::with_id(MENU_ID_STATUS_CODEX, "Codex: unavailable")
            .enabled(false)
            .build(app)?;
    let open_overview_item =
        MenuItemBuilder::with_id(MENU_ID_OPEN_OVERVIEW, "Open Overview").build(app)?;
    let refresh_all_item =
        MenuItemBuilder::with_id(MENU_ID_REFRESH_ALL, "Refresh All").build(app)?;
    let open_claude_dashboard_item = MenuItemBuilder::with_id(
        MENU_ID_OPEN_CLAUDE_DASHBOARD,
        "Open Claude Dashboard",
    )
    .build(app)?;
    let open_codex_dashboard_item = MenuItemBuilder::with_id(
        MENU_ID_OPEN_CODEX_DASHBOARD,
        "Open Codex Dashboard",
    )
    .build(app)?;
    let quit_item = MenuItemBuilder::with_id(MENU_ID_QUIT, "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &claude_status_item,
            &codex_status_item,
            &PredefinedMenuItem::separator(app)?,
            &open_overview_item,
            &refresh_all_item,
            &open_claude_dashboard_item,
            &open_codex_dashboard_item,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ])
        .build()?;

    let initial_icon_bytes = tray_icon::generate_tray_icon(None, None, 44);
    let initial_icon = Image::from_bytes(&initial_icon_bytes)?;

    let tray = TrayIconBuilder::with_id("quota-tray")
        .icon(initial_icon)
        .icon_as_template(false)
        .title("--")
        .tooltip("Quota Menubar")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_ID_OPEN_OVERVIEW => show_overview_window(app),
            MENU_ID_REFRESH_ALL => emit_refresh_event(app),
            MENU_ID_OPEN_CLAUDE_DASHBOARD => {
                let _ = link::open_claude_dashboard();
            }
            MENU_ID_OPEN_CODEX_DASHBOARD => {
                let _ = link::open_codex_dashboard();
            }
            MENU_ID_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        emit_overview_event(app);
                        position_window_near_tray(app, tray);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    let _ = tray.set_visible(true);

    if let Some(state) = app.try_state::<TrayState>() {
        if let Ok(mut guard) = state.tray_id.lock() {
            *guard = Some(tray.id().clone());
        }

        if let Ok(mut guard) = state.menu_handles.lock() {
            *guard = Some(TrayMenuHandles {
                claude_status: claude_status_item.clone(),
                codex_status: codex_status_item.clone(),
            });
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        let window_clone = window.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(false) = event {
                let _ = window_clone.hide();
            }
        });
    }

    println!("[Tray] Ready: quota-tray created");
    Ok(())
}

pub async fn update_tray_tooltip(
    app: AppHandle,
    tray_state: State<'_, TrayState>,
    payload: TrayDisplayData,
) -> Result<(), String> {
    let tray_id = {
        let guard = tray_state.tray_id.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let menu_handles = {
        let guard = tray_state.menu_handles.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let Some(id) = tray_id else {
        return Ok(());
    };

    let app_handle = app.clone();
    let (tx, rx) = mpsc::channel();

    app.run_on_main_thread(move || {
        let result = (|| -> Result<(), String> {
            let Some(tray) = app_handle.tray_by_id(&id) else {
                return Ok(());
            };

            let icon_bytes = tray_icon::generate_tray_icon(
                if payload.claude_connected {
                    payload.claude_percentage
                } else {
                    None
                },
                if payload.codex_connected {
                    payload.codex_percentage
                } else {
                    None
                },
                44,
            );
            let icon = Image::from_bytes(&icon_bytes).map_err(|e| e.to_string())?;
            let updated_at = Local::now().format("%H:%M:%S").to_string();

            tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
            tray.set_icon_as_template(false).map_err(|e| e.to_string())?;
            tray.set_title(Some(&format_tray_title(&payload)))
                .map_err(|e| e.to_string())?;
            tray.set_tooltip(Some(format_tooltip(&payload, &updated_at)))
                .map_err(|e| e.to_string())?;
            tray.set_visible(true).map_err(|e| e.to_string())?;

            if let Some(menu_handles) = menu_handles {
                menu_handles
                    .claude_status
                    .set_text(format_service_line(
                        "Claude Code",
                        payload.claude_connected,
                        payload.claude_percentage,
                    ))
                    .map_err(|e| e.to_string())?;
                menu_handles
                    .codex_status
                    .set_text(format_service_line(
                        "Codex",
                        payload.codex_connected,
                        payload.codex_percentage,
                    ))
                    .map_err(|e| e.to_string())?;
            }

            Ok(())
        })();

        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;

    rx.recv()
        .map_err(|_| "failed to receive tray update result".to_string())?
}

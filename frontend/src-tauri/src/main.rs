// FirmDesk desktop shell (Tauri 2, Windows-first).
//
// Hard rules from the split-surface spec that live here:
//  * Outbound-only: this app initiates every connection. No inbound ports.
//  * Tally's localhost:9000 is the only host the Rust side ever talks to;
//    it is never proxied to the network. (The webview talks to the API
//    origin via the normal fetch wrapper with session cookies.)
//  * One-way Tally rule: posting in, read-only import out — the commands
//    below only relay envelopes built cloud-side.
//  * No credentials persisted: the keychain stores a session snapshot
//    only, never the password.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use keyring::Entry;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

const TALLY_URL: &str = "http://localhost:9000";
const KEYCHAIN_SERVICE: &str = "in.jvaccounting.firmdesk";

static TRAY_TOOLTIP: Mutex<Option<String>> = Mutex::new(None);

// ---------------------------------------------------------------------------
// XML helpers (mirror backend/src/lib/tally.ts, kept intentionally tiny)
// ---------------------------------------------------------------------------

/// ASCII case-insensitive tag lookup; Tally replies are ASCII so byte
/// offsets are never shifted by case folding.
fn text_tag(body: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let haystack = body.as_bytes();
    let open_bytes = open.as_bytes();
    let close_bytes = close.as_bytes();

    let contains_at = |hay: &[u8], needle: &[u8], from: usize| -> Option<usize> {
        if needle.is_empty() || hay.len() < needle.len() {
            return None;
        }
        (from..=hay.len() - needle.len()).find(|&i| {
            hay[i..i + needle.len()]
                .iter()
                .zip(needle)
                .all(|(h, n)| h.to_ascii_uppercase() == n.to_ascii_uppercase())
        })
    };

    let start = contains_at(haystack, open_bytes, 0)?;
    let content_from = start + open.len();
    let end = contains_at(haystack, close_bytes, content_from)?;
    let raw = &body[content_from..end];
    Some(raw.trim().to_string())
}

// ---------------------------------------------------------------------------
// Tally bridge (localhost only)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TallyProbe {
    reachable: bool,
    company_name: Option<String>,
    education_mode: bool,
    version: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TallyPostResult {
    ok: bool,
    created: u32,
    already_exists: bool,
    reply: String,
    line_error: Option<String>,
}

/// POST a ready-made XML envelope to Tally's localhost server.
/// The envelope is always built cloud-side; this is a dumb relay.
#[tauri::command]
fn tally_post(xml: String) -> Result<TallyPostResult, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(TALLY_URL)
        .header("Content-Type", "text/xml;charset=utf-8")
        .body(xml)
        .send()
        .map_err(|e| format!("Could not reach Tally on {TALLY_URL}: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Tally HTTP {}", response.status()));
    }
    let reply = response.text().map_err(|e| e.to_string())?;
    let upper = reply.to_uppercase();
    let line_error = text_tag(&reply, "LINEERROR").filter(|e| !e.is_empty());
    let already_exists = upper.contains("DUPLICATE") || upper.contains("ALREADY EXIST");
    if let Some(ref err) = line_error {
        if !already_exists {
            return Ok(TallyPostResult {
                ok: false,
                created: 0,
                already_exists: false,
                reply: reply.chars().take(2000).collect(),
                line_error: Some(err.clone()),
            });
        }
    }
    let created = text_tag(&reply, "CREATED")
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(1);
    Ok(TallyPostResult {
        ok: true,
        created: if already_exists { 0 } else { created },
        already_exists,
        reply: reply.chars().take(2000).collect(),
        line_error: None,
    })
}

/// Probe Tally: reachable, open company, education mode, version.
#[tauri::command]
fn tally_probe() -> Result<TallyProbe, String> {
    let probe_xml = "<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>My Company</REPORTNAME><STATICVARIABLES><SVEXPORTFORMAT>$$SrvXML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>";
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let response = match client
        .post(TALLY_URL)
        .header("Content-Type", "text/xml;charset=utf-8")
        .body(probe_xml)
        .send()
    {
        Ok(r) => r,
        Err(_) => {
            return Ok(TallyProbe {
                reachable: false,
                company_name: None,
                education_mode: false,
                version: None,
            });
        }
    };
    if !response.status().is_success() {
        return Ok(TallyProbe {
            reachable: false,
            company_name: None,
            education_mode: false,
            version: None,
        });
    }
    let body = response.text().map_err(|e| e.to_string())?;
    let company = text_tag(&body, "NAME").or_else(|| text_tag(&body, "COMPANYNAME"));
    Ok(TallyProbe {
        reachable: company.as_deref().map(|n| !n.is_empty()).unwrap_or(false),
        company_name: company,
        education_mode: body.to_uppercase().contains("EDUCATION"),
        version: text_tag(&body, "VERSION"),
    })
}

// ---------------------------------------------------------------------------
// OS keychain (Windows Credential Manager)
// ---------------------------------------------------------------------------

#[tauri::command]
fn keychain_set(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn keychain_get(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn keychain_delete(key: String) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ---------------------------------------------------------------------------
// Session lock
// ---------------------------------------------------------------------------

/// Lock now: tells the front end to drop in-memory session state
/// (same event the OS-lock listener below emits on workstation lock).
#[tauri::command]
fn lock_now(app: AppHandle) -> Result<(), String> {
    app.emit("firmdesk://os-lock", true).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// OS-lock detection (rule: the session dies when the workstation locks)
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod os_lock {
    use std::sync::Mutex;
    use std::sync::OnceLock;

    use super::AppHandle;
    use super::Emitter;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, WTSUnRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
        WTS_SESSIONSTATE_LOCK, WTS_SESSIONSTATE_UNLOCK,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
        PostQuitMessage, RegisterClassW, TranslateMessage, MSG, WM_DESTROY, WNDCLASSW,
    };

    const WM_WTSSESSION_CHANGE: u32 = 0x02B1;
    const HWND_MESSAGE: HWND = -3isize as HWND;

    static APP_HANDLE: OnceLock<Mutex<Option<AppHandle>>> = OnceLock::new();

    fn utf16(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if msg == WM_WTSSESSION_CHANGE {
            if let Some(slot) = APP_HANDLE.get() {
                if let Ok(guard) = slot.lock() {
                    if let Some(app) = guard.as_ref() {
                        if wparam as u32 == WTS_SESSIONSTATE_LOCK {
                            let _ = app.emit("firmdesk://os-lock", true);
                        } else if wparam as u32 == WTS_SESSIONSTATE_UNLOCK {
                            let _ = app.emit("firmdesk://os-lock", false);
                        }
                    }
                }
            }
        }
        if msg == WM_DESTROY {
            PostQuitMessage(0);
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    /// Dedicated thread: registers a message-only window for WTS
    /// session-change notifications and forwards lock/unlock to the
    /// webview. Never blocks the Tauri main loop.
    fn listener_thread() {
        unsafe {
            let class_name = utf16("FirmDeskSessionListener");
            let class = WNDCLASSW {
                lpfnWndProc: Some(wnd_proc),
                lpszClassName: class_name.as_ptr(),
                ..Default::default()
            };
            if RegisterClassW(&class) == 0 {
                return;
            }

            let window_name = utf16("FirmDeskSessionListener");
            let hwnd = CreateWindowExW(
                0, // no extended style
                class_name.as_ptr(),
                window_name.as_ptr(),
                0, // message-only windows ignore style
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
            );
            if hwnd.is_null() {
                return;
            }

            if WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION) == 0 {
                let _ = DestroyWindow(hwnd);
                return;
            }

            let mut msg = MSG::default();
            loop {
                // GetMessageW blocks until a message arrives; returns 0 on
                // WM_QUIT, -1 on error — both end the loop.
                let result = GetMessageW(&mut msg, hwnd, 0, 0);
                if result <= 0 {
                    break;
                }
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            let _ = WTSUnRegisterSessionNotification(hwnd);
            let _ = DestroyWindow(hwnd);
        }
    }

    /// Start listening for OS lock/unlock. Safe to call once at setup;
    /// idempotent so a second call never spawns a duplicate listener.
    pub fn start(app: AppHandle) {
        let slot = APP_HANDLE.get_or_init(|| Mutex::new(None));
        if let Ok(mut guard) = slot.lock() {
            if guard.is_some() {
                return;
            }
            *guard = Some(app);
            std::thread::spawn(listener_thread);
        }
    }
}

/// Non-Windows fallback: no OS-lock events, `onOsLock` stays silent.
#[cfg(not(windows))]
mod os_lock {
    use super::AppHandle;

    pub fn start(_app: AppHandle) {}
}

// ---------------------------------------------------------------------------
// App info (workstation registration payload)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAppInfo {
    version: String,
    device_name: String,
    platform: String,
    os_version: String,
}

#[tauri::command]
fn app_info(app: AppHandle) -> Result<DesktopAppInfo, String> {
    let version = app.package_info().version.to_string();
    let user = whoami::fallible::username().unwrap_or_default();
    let host = whoami::fallible::hostname().unwrap_or_default();
    let device_name = if host.is_empty() {
        format!("{user}-PC")
    } else {
        format!("{user} ({host})")
    };
    Ok(DesktopAppInfo {
        version,
        device_name,
        platform: std::env::consts::OS.to_string(),
        os_version: whoami::fallible::distro().unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

fn set_tray_tooltip(app: &AppHandle, tooltip: String) {
    if let Some(tray) = app.tray_by_id("firmdesk-tray") {
        let _ = tray.set_tooltip(Some(tooltip.clone()));
    }
    if let Ok(mut slot) = TRAY_TOOLTIP.lock() {
        *slot = Some(tooltip);
    }
}

/// Front end pushes tray state after each heartbeat: workstation online,
/// Tally reachable, open company.
#[tauri::command]
fn set_tray_status(app: AppHandle, online: bool, tally: bool, company: String) -> Result<(), String> {
    let company_display = if company.is_empty() { "—".into() } else { company };
    let tooltip = format!(
        "FirmDesk — {} · Tally {} · {}",
        if online { "Online" } else { "Offline" },
        if tally { "Connected" } else { "Not reachable" },
        company_display
    );
    set_tray_tooltip(&app, tooltip);
    Ok(())
}

fn main() {
    let single_instance = tauri_plugin_single_instance::init(|app, _args, _cwd| {
        // Second launch: focus the already-running window.
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(single_instance)
        .invoke_handler(tauri::generate_handler![
            tally_post,
            tally_probe,
            keychain_set,
            keychain_get,
            keychain_delete,
            lock_now,
            app_info,
            set_tray_status
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // OS-lock listener: emits firmdesk://os-lock on session
            // lock/unlock so the front end can kill the session (rule:
            // the session dies when the workstation locks).
            os_lock::start(handle.clone());

            let _tray = TrayIconBuilder::with_id("firmdesk-tray")
                .tooltip("FirmDesk — starting…")
                // Same icon as the window/app so the tray is never blank
                // (the config-level trayIcon is deliberately unused —
                // it would create a SECOND tray we cannot address by id).
                .icon(app.default_window_icon().cloned().ok_or("no app icon")?)
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            set_tray_tooltip(&handle, "FirmDesk — starting…".to_string());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("FirmDesk desktop shell failed to start");
}

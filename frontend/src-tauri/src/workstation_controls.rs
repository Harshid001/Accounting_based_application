use serde::Serialize;
use serde_json::json;
use std::process::Command;

const ALLOWED_COMMANDS: [&str; 6] = ["powershell.exe", "powershell", "pwsh.exe", "pwsh", "cmd.exe", "cmd"];
const ALLOWED_APPS: [&str; 12] = [
    "chrome.exe", "chrome",
    "msedge.exe", "msedge",
    "excel.exe", "excel",
    "tally.exe", "tally",
    "calc.exe", "calc",
    "notepad.exe", "notepad",
];

fn is_allowed(value: &str, allowed: &[&str]) -> bool {
    allowed.contains(&value.to_ascii_lowercase().as_str())
}

#[derive(Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    #[serde(rename = "memoryBytes")]
    pub memory_bytes: Option<u64>,
}

#[tauri::command]
pub fn run_shell_command(command: String, arguments: Option<Vec<String>>) -> Result<serde_json::Value, String> {
    if !is_allowed(&command, &ALLOWED_COMMANDS) {
        return Err("Command is not allowlisted.".to_string());
    }
    let output = Command::new(command)
        .args(arguments.unwrap_or_default())
        .output()
        .map_err(|error| error.to_string())?;
    Ok(json!({
        "stdout": String::from_utf8_lossy(&output.stdout),
        "stderr": String::from_utf8_lossy(&output.stderr),
        "exitCode": output.status.code()
    }))
}

#[tauri::command]
pub fn launch_interactive_app(application: String, url: Option<String>) -> Result<(), String> {
    if !is_allowed(&application, &ALLOWED_APPS) {
        return Err("Application is not allowlisted.".to_string());
    }
    let mut command = Command::new(application);
    if let Some(url) = url {
        if !url.starts_with("https://") {
            return Err("Only HTTPS URLs are allowed.".to_string());
        }
        command.arg(url);
    }
    command.spawn().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_processes() -> Result<Vec<ProcessInfo>, String> {
    let output = Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output()
        .map_err(|error| error.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);
    let mut processes = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.split("\",\"").collect();
        if parts.len() >= 2 {
            let name = parts[0].trim_start_matches('"').to_string();
            let pid = parts[1].trim_matches('"').parse::<u32>().unwrap_or(0);
            let memory_bytes = if parts.len() >= 5 {
                let mem_str = parts[4]
                    .trim_end_matches('"')
                    .replace(',', "")
                    .replace(" K", "")
                    .replace(' ', "");
                mem_str.parse::<u64>().ok().map(|kb| kb * 1024)
            } else {
                None
            };
            processes.push(ProcessInfo {
                pid,
                name,
                memory_bytes,
            });
        }
    }
    Ok(processes)
}

#[tauri::command]
pub fn read_local_file(path: String) -> Result<serde_json::Value, String> {
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    if bytes.len() > 512 * 1024 {
        return Err("File exceeds 512 KB.".to_string());
    }
    Ok(json!({
        "content": String::from_utf8_lossy(&bytes),
        "bytes": bytes.len()
    }))
}

#[tauri::command]
pub fn write_local_file(path: String, content: String, create_only: Option<bool>) -> Result<(), String> {
    let target = std::path::Path::new(&path);
    if target.exists() && create_only.unwrap_or(true) {
        return Err("File already exists.".to_string());
    }
    std::fs::write(target, content).map_err(|error| error.to_string())
}

use axum::{extract::Json as JsonExtract, response::Json};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSettings {
    #[serde(rename = "streamSource")]
    pub stream_source: String,
    #[serde(rename = "audioQuality")]
    pub audio_quality: String,
    #[serde(rename = "invidiousInstance")]
    pub invidious_instance: String,
    #[serde(rename = "zapretMode")]
    pub zapret_mode: bool,
    #[serde(rename = "zapretPort")]
    pub zapret_port: u16,
    #[serde(rename = "scEngine")]
    pub sc_engine: String,
}

impl Default for NetworkSettings {
    fn default() -> Self {
        Self {
            stream_source: "yt-dlp".to_string(),
            audio_quality: "medium".to_string(),
            invidious_instance: "https://invidious.nerdvpn.de".to_string(),
            zapret_mode: false,
            zapret_port: 1080,
            sc_engine: "alt".to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub ok: bool,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Serialize)]
pub struct LanResponse {
    pub port: u16,
    pub addresses: Vec<String>,
}

#[derive(Clone)]
pub struct NetworkService {
    pub settings: Arc<RwLock<NetworkSettings>>,
}

impl NetworkService {
    pub fn new() -> Self {
        Self {
            settings: Arc::new(RwLock::new(NetworkSettings::default())),
        }
    }

    pub fn get_lan_addresses(&self, port: u16) -> Vec<String> {
        let mut ips = Vec::new();
        if let Ok(interfaces) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if interfaces.connect("8.8.8.8:80").is_ok() {
                if let Ok(local_addr) = interfaces.local_addr() {
                    ips.push(format!("http://{}:{}", local_addr.ip(), port));
                }
            }
        }
        if ips.is_empty() {
            ips.push(format!("http://127.0.0.1:{}", port));
        }
        ips
    }
}

pub async fn handle_health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        name: "RIZE".to_string(),
        version: "1.3.0".to_string(),
    })
}

pub async fn handle_lan(
    axum::extract::State(service): axum::extract::State<NetworkService>,
) -> Json<LanResponse> {
    let port = 17217;
    let addresses = service.get_lan_addresses(port);
    Json(LanResponse { port, addresses })
}

pub async fn handle_get_settings(
    axum::extract::State(service): axum::extract::State<NetworkService>,
) -> Json<NetworkSettings> {
    let s = service.settings.read().map(|c| c.clone()).unwrap_or_default();
    Json(s)
}

pub async fn handle_save_settings(
    axum::extract::State(service): axum::extract::State<NetworkService>,
    JsonExtract(new_settings): JsonExtract<NetworkSettings>,
) -> Json<serde_json::Value> {
    if let Ok(mut lock) = service.settings.write() {
        *lock = new_settings.clone();
    }
    Json(serde_json::json!({
        "updated": true,
        "config": new_settings
    }))
}

pub async fn handle_launcher_install() -> Json<serde_json::Value> {
    let script_paths = [
        std::path::PathBuf::from("scripts/update-desktop-shortcut.sh"),
        std::path::PathBuf::from("../scripts/update-desktop-shortcut.sh"),
    ];

    for path in script_paths {
        if path.exists() {
            let _ = std::process::Command::new("bash")
                .arg(&path)
                .output();
            return Json(serde_json::json!({ "success": true, "installed": true }));
        }
    }

    Json(serde_json::json!({ "success": true, "noop": true }))
}

pub async fn handle_state(
    JsonExtract(payload): JsonExtract<serde_json::Value>,
) -> Json<serde_json::Value> {
    let _ = payload;
    Json(serde_json::json!({ "ok": true }))
}

pub async fn handle_discord_presence(
    JsonExtract(payload): JsonExtract<serde_json::Value>,
) -> Json<serde_json::Value> {
    let _ = payload;
    Json(serde_json::json!({ "ok": true }))
}

pub async fn handle_debug_log(
    JsonExtract(payload): JsonExtract<serde_json::Value>,
) -> Json<serde_json::Value> {
    let _ = payload;
    Json(serde_json::json!({ "ok": true }))
}

pub async fn handle_audio_engine(
    JsonExtract(payload): JsonExtract<serde_json::Value>,
) -> Json<serde_json::Value> {
    let engine = payload["engine"].as_str().unwrap_or("ytdlp");
    Json(serde_json::json!({ "ok": true, "engine": engine }))
}

pub async fn handle_zapret(
    JsonExtract(payload): JsonExtract<serde_json::Value>,
) -> Json<serde_json::Value> {
    let enabled = payload["enabled"].as_bool().unwrap_or(false);
    Json(serde_json::json!({ "ok": true, "enabled": enabled }))
}

pub async fn handle_soundcloud_engine(
    JsonExtract(payload): JsonExtract<serde_json::Value>,
) -> Json<serde_json::Value> {
    let engine = payload["engine"].as_str().unwrap_or("alt");
    Json(serde_json::json!({ "ok": true, "engine": engine }))
}

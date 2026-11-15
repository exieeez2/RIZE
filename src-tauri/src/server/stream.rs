use axum::{
    body::Body,
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use super::search::SearchService;

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub id: Option<String>,
    pub engine: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub q: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StreamInfoResponse {
    pub success: bool,
    pub id: String,
    pub url: String,
    #[serde(rename = "streamUrl")]
    pub stream_url: String,
    #[serde(rename = "proxyUrl")]
    pub proxy_url: String,
    pub format: String,
}

#[derive(Clone)]
pub struct StreamService {
    client: reqwest::Client,
    search: SearchService,
    cache: Arc<RwLock<HashMap<String, (String, Instant)>>>,
}

impl StreamService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(12))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();
        Self {
            client,
            search: SearchService::new(),
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn new_with_search(search: SearchService) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(12))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();
        Self {
            client,
            search,
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn find_ytdlp() -> PathBuf {
        let bin_name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
        let candidates = [
            PathBuf::from("bin").join(bin_name),
            PathBuf::from("../bin").join(bin_name),
            PathBuf::from("/usr/bin").join(bin_name),
            PathBuf::from("/usr/local/bin").join(bin_name),
        ];

        for c in candidates {
            if c.exists() {
                return c;
            }
        }
        PathBuf::from(bin_name)
    }

    pub async fn fetch_fast_innertube_stream_url(&self, video_id: &str) -> Option<String> {
        let clean_id = video_id.trim();
        if clean_id.is_empty() {
            return None;
        }

        // Check in-memory stream cache (valid for 6 hours)
        if let Ok(c) = self.cache.read() {
            if let Some((url, exp)) = c.get(clean_id) {
                if exp.elapsed() < Duration::from_secs(21600) {
                    return Some(url.clone());
                }
            }
        }

        let clients = [
            ("ANDROID_VR", "1.58.19", 32),
            ("ANDROID_MUSIC", "6.42.52", 31),
            ("ANDROID", "19.29.37", 30),
        ];

        for (client_name, client_version, sdk_ver) in clients {
            let payload = serde_json::json!({
                "videoId": clean_id,
                "context": {
                    "client": {
                        "clientName": client_name,
                        "clientVersion": client_version,
                        "androidSdkVersion": sdk_ver,
                        "hl": "en",
                        "gl": "US"
                    }
                }
            });

            let resp = self.client
                .post("https://www.youtube.com/youtubei/v1/player")
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .header(reqwest::header::USER_AGENT, "com.google.android.apps.youtube.vr/1.58.19 (Linux; U; Android 12; Quest 2)")
                .json(&payload)
                .send()
                .await;

            if let Ok(r) = resp {
                if let Ok(val) = r.json::<serde_json::Value>().await {
                    if let Some(formats) = val["streamingData"]["adaptiveFormats"].as_array() {
                        let mut audio_formats: Vec<&serde_json::Value> = formats
                            .iter()
                            .filter(|f| {
                                f["mimeType"].as_str().map(|m| m.starts_with("audio/")).unwrap_or(false)
                                    && f["url"].as_str().is_some()
                            })
                            .collect();

                        if !audio_formats.is_empty() {
                            // Sort: strict preference for Opus codec (128-160k) and higher bitrate
                            audio_formats.sort_by(|a, b| {
                                let a_opus = a["mimeType"].as_str().map(|m| m.contains("opus")).unwrap_or(false);
                                let b_opus = b["mimeType"].as_str().map(|m| m.contains("opus")).unwrap_or(false);
                                if a_opus != b_opus {
                                    return b_opus.cmp(&a_opus);
                                }
                                let a_br = a["bitrate"].as_u64().unwrap_or(0);
                                let b_br = b["bitrate"].as_u64().unwrap_or(0);
                                b_br.cmp(&a_br)
                            });

                            if let Some(best_url) = audio_formats[0]["url"].as_str() {
                                let res_url = best_url.to_string();
                                if let Ok(mut c) = self.cache.write() {
                                    c.insert(clean_id.to_string(), (res_url.clone(), Instant::now()));
                                }
                                return Some(res_url);
                            }
                        }
                    }
                }
            }
        }

        None
    }

    pub async fn resolve_youtube_stream_url(&self, video_id: &str) -> Option<String> {
        let clean_id = video_id.trim();
        if clean_id.is_empty() {
            return None;
        }

        // 1. Check in-memory stream cache (valid for 6 hours)
        if let Ok(c) = self.cache.read() {
            if let Some((url, exp)) = c.get(clean_id) {
                if exp.elapsed() < Duration::from_secs(21600) {
                    return Some(url.clone());
                }
            }
        }

        // 2. Fast direct InnerTube player API extraction (~100-200ms)
        if let Some(fast_url) = self.fetch_fast_innertube_stream_url(clean_id).await {
            return Some(fast_url);
        }

        // 3. Fallback to yt-dlp binary without blocking async runtime
        let id_owned = clean_id.to_string();
        let cache_clone = self.cache.clone();
        tokio::task::spawn_blocking(move || {
            let ytdlp = Self::find_ytdlp();
            let target_url = format!("https://www.youtube.com/watch?v={}", id_owned);

            let output = Command::new(&ytdlp)
                .args([
                    "--no-check-certificates",
                    "--no-warnings",
                    "--no-playlist",
                    "--quiet",
                    "--extractor-args",
                    "youtube:player_client=android",
                    "-g",
                    "-f",
                    "bestaudio/best",
                    &target_url,
                ])
                .output()
                .ok()?;

            if output.status.success() {
                let out = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if let Some(first_url) = out.lines().next() {
                    if first_url.starts_with("http") {
                        let res_url = first_url.to_string();
                        if let Ok(mut c) = cache_clone.write() {
                            c.insert(id_owned.clone(), (res_url.clone(), Instant::now()));
                        }
                        return Some(res_url);
                    }
                }
            }

            // Fallback without extractor-args if first attempt failed
            let fallback_output = Command::new(&ytdlp)
                .args(["-g", "-f", "bestaudio/best", "--no-warnings", &target_url])
                .output()
                .ok()?;

            if fallback_output.status.success() {
                let out = String::from_utf8_lossy(&fallback_output.stdout).trim().to_string();
                if let Some(first_url) = out.lines().next() {
                    if first_url.starts_with("http") {
                        let res_url = first_url.to_string();
                        if let Ok(mut c) = cache_clone.write() {
                            c.insert(id_owned.clone(), (res_url.clone(), Instant::now()));
                        }
                        return Some(res_url);
                    }
                }
            }

            None
        })
        .await
        .ok()?
    }

    pub async fn resolve_deezer_stream(
        &self,
        dz_id: &str,
        artist: &str,
        title: &str,
    ) -> Option<String> {
        let raw_id = dz_id.trim_start_matches("dz_");
        let mut q = format!("{} {}", artist, title).trim().to_string();
        let mut preview_url = None;

        if q.is_empty() {
            let track_url = format!("https://api.deezer.com/track/{}", raw_id);
            if let Ok(res) = self.client.get(&track_url).send().await {
                if let Ok(val) = res.json::<serde_json::Value>().await {
                    let t = val["title"].as_str().unwrap_or("");
                    let a = val["artist"]["name"].as_str().unwrap_or("");
                    if let Some(p) = val["preview"].as_str() {
                        preview_url = Some(p.to_string());
                    }
                    q = format!("{} {}", a, t).trim().to_string();
                }
            }
        }

        if !q.is_empty() {
            let search_results = self.search.search_youtube(&q, 1).await;
            if let Some(first) = search_results.first() {
                if let Some(stream_url) = self.resolve_youtube_stream_url(&first.id).await {
                    return Some(stream_url);
                }
            }
        }

        preview_url
    }

    pub async fn resolve_soundcloud_stream_url(&self, sc_id: &str) -> Option<String> {
        let numeric_id = sc_id.trim_start_matches("sc_");
        let client_id = "a3dd183a579fc1b8bbf880aa0f3fd6b1";
        let meta_url = format!(
            "https://api-v2.soundcloud.com/tracks/{}?client_id={}",
            numeric_id, client_id
        );

        let resp = self.client.get(&meta_url).send().await.ok()?;
        let val: serde_json::Value = resp.json().await.ok()?;
        let trans = val["media"]["transcodings"].as_array()?;

        for t in trans {
            let protocol = t["format"]["protocol"].as_str().unwrap_or("");
            if protocol == "progressive" || protocol == "hls" {
                if let Some(stream_url) = t["url"].as_str() {
                    let sub_res = self
                        .client
                        .get(&format!("{}?client_id={}", stream_url, client_id))
                        .send()
                        .await
                        .ok()?;
                    let sub_val: serde_json::Value = sub_res.json().await.ok()?;
                    if let Some(final_url) = sub_val["url"].as_str() {
                        return Some(final_url.to_string());
                    }
                }
            }
        }
        None
    }

    pub fn generate_demo_wav(duration_secs: u32, freq: f32) -> Vec<u8> {
        let sample_rate = 22050u32;
        let num_samples = sample_rate * duration_secs;
        let data_size = num_samples * 2;
        let mut wav = Vec::with_capacity((44 + data_size) as usize);

        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_size).to_le_bytes());
        wav.extend_from_slice(b"WAVE");
        wav.extend_from_slice(b"fmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_size.to_le_bytes());

        for i in 0..num_samples {
            let t = i as f32 / sample_rate as f32;
            let envelope = (t * 2.0).min(1.0) * ((duration_secs as f32 - t) * 0.5).clamp(0.0, 1.0);
            let sample = (envelope * (t * freq * 2.0 * std::f32::consts::PI).sin() * 12000.0) as i16;
            wav.extend_from_slice(&sample.to_le_bytes());
        }
        wav
    }

    pub async fn proxy_stream(&self, target_url: &str, range_header: Option<&str>) -> Response {
        let mut req = self.client.get(target_url);
        if let Some(r) = range_header {
            req = req.header(header::RANGE, r);
        }
        req = req.header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        );

        let upstream = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[Stream Proxy] Failed upstream request: {}", e);
                return (StatusCode::BAD_GATEWAY, "Failed to connect to audio upstream").into_response();
            }
        };

        let status = upstream.status();
        let mut resp = Response::builder().status(status);

        if let Some(ct) = upstream.headers().get(header::CONTENT_TYPE) {
            resp = resp.header(header::CONTENT_TYPE, ct);
        } else {
            resp = resp.header(header::CONTENT_TYPE, "audio/webm");
        }

        if let Some(cr) = upstream.headers().get(header::CONTENT_RANGE) {
            resp = resp.header(header::CONTENT_RANGE, cr);
        }
        if let Some(cl) = upstream.headers().get(header::CONTENT_LENGTH) {
            resp = resp.header(header::CONTENT_LENGTH, cl);
        }

        resp = resp.header(header::ACCEPT_RANGES, "bytes");
        resp = resp.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");

        let body = Body::from_stream(upstream.bytes_stream());
        resp.body(body)
            .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Stream construction error").into_response())
    }
}

pub async fn handle_stream(
    axum::extract::State(service): axum::extract::State<StreamService>,
    headers: HeaderMap,
    Query(q): Query<StreamQuery>,
) -> Response {
    let id = q.id.as_deref().unwrap_or("").trim();
    if id.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing track id").into_response();
    }

    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    let artist = q.artist.as_deref().unwrap_or("");
    let title = q.title.as_deref().unwrap_or("");

    if id.starts_with("demo-") {
        let wav_bytes = StreamService::generate_demo_wav(26, 220.0);
        return (
            [
                (header::CONTENT_TYPE, "audio/wav"),
                (header::ACCEPT_RANGES, "bytes"),
                (header::CACHE_CONTROL, "public, max-age=3600"),
            ],
            wav_bytes,
        )
            .into_response();
    }

    if id.starts_with("dz_") {
        if let Some(direct_url) = service.resolve_deezer_stream(id, artist, title).await {
            return service.proxy_stream(&direct_url, range).await;
        }
    } else if id.starts_with("sc_") {
        if let Some(direct_url) = service.resolve_soundcloud_stream_url(id).await {
            return service.proxy_stream(&direct_url, range).await;
        }
    } else {
        if let Some(direct_url) = service.resolve_youtube_stream_url(id).await {
            return service.proxy_stream(&direct_url, range).await;
        }
        let fallback_q = if !artist.is_empty() && !title.is_empty() {
            format!("{} {}", artist, title)
        } else {
            q.q.unwrap_or_default()
        };
        if !fallback_q.is_empty() {
            let search_results = service.search.search_youtube(&fallback_q, 1).await;
            if let Some(first) = search_results.first() {
                if let Some(direct_url) = service.resolve_youtube_stream_url(&first.id).await {
                    return service.proxy_stream(&direct_url, range).await;
                }
            }
        }
    }

    (StatusCode::NOT_FOUND, "Failed to resolve stream").into_response()
}

pub async fn handle_stream_info(
    axum::extract::State(service): axum::extract::State<StreamService>,
    Query(q): Query<StreamQuery>,
) -> Response {
    let id = q.id.as_deref().unwrap_or("").trim();
    if id.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing track id").into_response();
    }

    let artist = q.artist.as_deref().unwrap_or("");
    let title = q.title.as_deref().unwrap_or("");

    let url_opt = if id.starts_with("dz_") {
        service.resolve_deezer_stream(id, artist, title).await
    } else if id.starts_with("sc_") {
        service.resolve_soundcloud_stream_url(id).await
    } else {
        service.resolve_youtube_stream_url(id).await
    };

    let proxy = format!(
        "/api/stream?id={}&title={}&artist={}",
        urlencoding::encode(id),
        urlencoding::encode(title),
        urlencoding::encode(artist)
    );

    match url_opt {
        Some(url) => axum::response::Json(StreamInfoResponse {
            success: true,
            id: id.to_string(),
            url: proxy.clone(),
            stream_url: url,
            proxy_url: proxy,
            format: "audio".to_string(),
        })
        .into_response(),
        None => (StatusCode::NOT_FOUND, "Failed to resolve stream info").into_response(),
    }
}

#[derive(Debug, Serialize)]
pub struct EngineStatusResponse {
    #[serde(rename = "hasAudius")]
    pub has_audius: bool,
    #[serde(rename = "activeEngine")]
    pub active_engine: String,
    pub badge: String,
    pub bitrate: u32,
    pub message: String,
}

pub async fn handle_engine_status() -> axum::response::Json<EngineStatusResponse> {
    axum::response::Json(EngineStatusResponse {
        has_audius: false,
        active_engine: "ytdlp-hq".to_string(),
        badge: "OPUS HQ 256K".to_string(),
        bitrate: 256,
        message: "Аудио-движок: yt-dlp Opus HQ (256 kbps)".to_string(),
    })
}

#[derive(Debug, Serialize)]
pub struct AudioOutputInfoResponse {
    pub name: String,
    #[serde(rename = "isBluetooth")]
    pub is_bluetooth: bool,
    pub battery: Option<u32>,
}

pub async fn handle_audio_output_info() -> axum::response::Json<AudioOutputInfoResponse> {
    axum::response::Json(AudioOutputInfoResponse {
        name: "Системный вывод".to_string(),
        is_bluetooth: false,
        battery: None,
    })
}

#[derive(Debug, Deserialize)]
pub struct LocalMediaQuery {
    pub file: Option<String>,
    pub path: Option<String>,
}

pub async fn handle_local_media(Query(q): Query<LocalMediaQuery>) -> Response {
    let raw = q.file.or(q.path).unwrap_or_default();
    let mut file_path = raw.trim().to_string();
    if file_path.starts_with("file://") {
        file_path = file_path.trim_start_matches("file://").to_string();
    }
    if file_path.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing file path").into_response();
    }
    let p = std::path::Path::new(&file_path);
    if !p.exists() || !p.is_file() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    match tokio::fs::read(p).await {
        Ok(bytes) => {
            let mime = match p
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase()
                .as_str()
            {
                "jpg" | "jpeg" => "image/jpeg",
                "png" => "image/png",
                "webp" => "image/webp",
                "gif" => "image/gif",
                "mp3" => "audio/mpeg",
                "flac" => "audio/flac",
                "wav" => "audio/wav",
                "mp4" => "video/mp4",
                "webm" => "video/webm",
                _ => "application/octet-stream",
            };
            (
                [
                    (header::CONTENT_TYPE, mime),
                    (header::CACHE_CONTROL, "no-cache, must-revalidate"),
                ],
                bytes,
            )
                .into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file").into_response(),
    }
}

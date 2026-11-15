use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub fn get_data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("RIFF_DATA_DIR") {
        if !dir.trim().is_empty() {
            let p = PathBuf::from(dir.trim());
            let _ = std::fs::create_dir_all(&p);
            return p;
        }
    }
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let dir = home.join(".cache").join("devsize");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn get_cache_dir() -> PathBuf {
    let p = get_data_dir().join("tracks");
    let _ = std::fs::create_dir_all(&p);
    p
}

pub fn get_thumbnails_dir() -> PathBuf {
    let p = get_data_dir().join("thumbnails");
    let _ = std::fs::create_dir_all(&p);
    p
}

pub fn get_custom_lyrics_dir() -> PathBuf {
    let p = get_data_dir().join("custom-lyrics");
    let _ = std::fs::create_dir_all(&p);
    p
}

pub fn get_library_dir() -> PathBuf {
    let p = get_data_dir().join("library");
    let _ = std::fs::create_dir_all(&p);
    p
}

fn get_library_path() -> PathBuf {
    get_data_dir().join("library.json")
}

fn get_metadata_path() -> PathBuf {
    get_data_dir().join("metadata.json")
}

fn clean_track_id(id: &str) -> String {
    id.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryItem {
    pub id: String,
    #[serde(default)]
    pub file: String,
    #[serde(default)]
    pub ext: String,
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub duration: f64,
    #[serde(rename = "addedAt", default)]
    pub added_at: u64,
}

#[derive(Debug, Deserialize)]
pub struct LibraryAddPayload {
    pub items: Option<Vec<LibraryItemInput>>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryItemInput {
    pub id: Option<String>,
    pub file: Option<String>,
    pub name: Option<String>,
    pub ext: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryUpdatePayload {
    pub id: Option<String>,
    pub duration: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryRemovePayload {
    pub id: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct IdQuery {
    pub id: Option<String>,
    pub name: Option<String>,
    pub url: Option<String>,
    pub platform: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
}

// 1. GET /api/library
pub async fn handle_library() -> Json<Vec<Value>> {
    let lib_path = get_library_path();
    let mut items = Vec::new();
    if lib_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&lib_path) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, LibraryItem>>(&content) {
                let mut sorted: Vec<_> = map.into_values().collect();
                sorted.sort_by(|a, b| b.added_at.cmp(&a.added_at));
                for item in sorted {
                    items.push(json!({
                        "id": item.id,
                        "platform": "local",
                        "title": item.title,
                        "artist": item.artist,
                        "duration": item.duration,
                        "thumbnail": ""
                    }));
                }
            }
        }
    }
    Json(items)
}

// 2. POST /api/library-add
pub async fn handle_library_add(Json(payload): Json<LibraryAddPayload>) -> Json<Value> {
    let items = payload.items.unwrap_or_default();
    let lib_path = get_library_path();
    let mut map: HashMap<String, LibraryItem> = if lib_path.exists() {
        std::fs::read_to_string(&lib_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        HashMap::new()
    };

    let lib_dir = get_library_dir();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut added_count = 0;
    for input in items {
        let id = match input.id {
            Some(i) if !i.trim().is_empty() => i.trim().to_string(),
            _ => continue,
        };
        let file = match input.file {
            Some(f) if !f.trim().is_empty() => f.trim().to_string(),
            _ => continue,
        };

        let full_path = lib_dir.join(&file);
        if !full_path.exists() {
            continue;
        }

        let raw_name = input.name.unwrap_or_default();
        let clean_name = raw_name.trim();

        let (artist, title) = if let Some((a, t)) = clean_name.split_once(" - ") {
            (a.trim().to_string(), t.trim().to_string())
        } else {
            ("Unknown artist".to_string(), clean_name.to_string())
        };

        let ext = input
            .ext
            .unwrap_or_else(|| Path::new(&file).extension().and_then(|e| e.to_str()).unwrap_or("mp3").to_string());

        map.insert(
            id.clone(),
            LibraryItem {
                id,
                file,
                ext,
                title: if title.is_empty() { "Untitled".to_string() } else { title },
                artist: if artist.is_empty() { "Unknown artist".to_string() } else { artist },
                duration: 0.0,
                added_at: now,
            },
        );
        added_count += 1;
    }

    if let Ok(serialized) = serde_json::to_string_pretty(&map) {
        let _ = std::fs::write(&lib_path, serialized);
    }

    Json(json!({ "success": true, "count": added_count }))
}

// 3. POST /api/library-update
pub async fn handle_library_update(Json(payload): Json<LibraryUpdatePayload>) -> Json<Value> {
    if let Some(id) = payload.id {
        let lib_path = get_library_path();
        if let Ok(content) = std::fs::read_to_string(&lib_path) {
            if let Ok(mut map) = serde_json::from_str::<HashMap<String, LibraryItem>>(&content) {
                if let Some(item) = map.get_mut(&id) {
                    if let Some(dur) = payload.duration {
                        item.duration = dur;
                    }
                    if let Ok(serialized) = serde_json::to_string_pretty(&map) {
                        let _ = std::fs::write(&lib_path, serialized);
                    }
                }
            }
        }
    }
    Json(json!({ "success": true }))
}

// 4. POST /api/library-remove
pub async fn handle_library_remove(Json(payload): Json<LibraryRemovePayload>) -> Json<Value> {
    if let Some(id) = payload.id {
        let lib_path = get_library_path();
        if let Ok(content) = std::fs::read_to_string(&lib_path) {
            if let Ok(mut map) = serde_json::from_str::<HashMap<String, LibraryItem>>(&content) {
                if let Some(item) = map.remove(&id) {
                    let file_path = get_library_dir().join(&item.file);
                    let _ = std::fs::remove_file(file_path);
                    if let Ok(serialized) = serde_json::to_string_pretty(&map) {
                        let _ = std::fs::write(&lib_path, serialized);
                    }
                }
            }
        }
    }
    Json(json!({ "success": true }))
}

// 5. GET /api/offline-library
pub async fn handle_offline_library() -> Json<Value> {
    let cache_dir = get_cache_dir();
    let meta_path = get_metadata_path();
    let metadata: HashMap<String, Value> = if meta_path.exists() {
        std::fs::read_to_string(&meta_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        HashMap::new()
    };

    let mut tracks = Vec::new();
    let mut total_bytes = 0u64;

    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default();
            if file_name.contains(".temp.") {
                continue;
            }

            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if matches!(ext.as_str(), "opus" | "webm" | "m4a" | "mp3" | "wav" | "flac") {
                let clean_id = path.file_stem().and_then(|s| s.to_str()).unwrap_or(file_name);
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                total_bytes += size;

                let meta = metadata.get(clean_id).cloned().unwrap_or_else(|| json!({}));
                let title = meta["title"].as_str().unwrap_or(clean_id);
                let artist = meta["artist"].as_str().unwrap_or("Unknown artist");
                let duration = meta["duration"].as_f64().unwrap_or(0.0);
                let thumbnail = meta["thumbnail"].as_str().unwrap_or("");

                tracks.push(json!({
                    "id": clean_id,
                    "cleanId": clean_id,
                    "title": title,
                    "artist": artist,
                    "duration": duration,
                    "thumbnail": thumbnail,
                    "fileSize": size,
                    "platform": meta["platform"].as_str().unwrap_or("youtube")
                }));
            }
        }
    }

    Json(json!({
        "success": true,
        "count": tracks.len(),
        "totalBytes": total_bytes,
        "tracks": tracks
    }))
}

// 6. POST /api/offline-delete
pub async fn handle_offline_delete(Query(q): Query<IdQuery>) -> Json<Value> {
    let track_id = clean_track_id(q.id.as_deref().unwrap_or(""));
    if !track_id.is_empty() {
        let cache_dir = get_cache_dir();
        for ext in &["opus", "webm", "m4a", "mp3", "wav", "flac"] {
            let p = cache_dir.join(format!("{}.{}", track_id, ext));
            if p.exists() {
                let _ = std::fs::remove_file(p);
            }
        }
        let thumb_path = get_thumbnails_dir().join(format!("{}.jpg", track_id));
        let _ = std::fs::remove_file(thumb_path);

        let meta_path = get_metadata_path();
        if meta_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&meta_path) {
                if let Ok(mut map) = serde_json::from_str::<HashMap<String, Value>>(&content) {
                    map.remove(&track_id);
                    if let Ok(serialized) = serde_json::to_string_pretty(&map) {
                        let _ = std::fs::write(&meta_path, serialized);
                    }
                }
            }
        }
    }
    Json(json!({ "success": true }))
}

// 7. POST /api/clear-offline-library
pub async fn handle_clear_offline_library() -> Json<Value> {
    let cache_dir = get_cache_dir();
    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }
    }
    let thumb_dir = get_thumbnails_dir();
    if let Ok(entries) = std::fs::read_dir(&thumb_dir) {
        for entry in entries.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }
    }
    let meta_path = get_metadata_path();
    let _ = std::fs::write(&meta_path, "{}");
    Json(json!({ "success": true }))
}

// 8. GET /api/check-cache
pub async fn handle_check_cache(Query(q): Query<IdQuery>) -> Json<Value> {
    let track_id = clean_track_id(q.id.as_deref().unwrap_or(""));
    if track_id.is_empty() {
        return Json(json!({ "cached": false, "streamUrl": null }));
    }

    let cache_dir = get_cache_dir();
    for ext in &["opus", "webm", "m4a", "mp3", "wav", "flac"] {
        let p = cache_dir.join(format!("{}.{}", track_id, ext));
        if p.exists() {
            return Json(json!({
                "cached": true,
                "streamUrl": format!("http://127.0.0.1:17217/api/local-track?id={}", track_id)
            }));
        }
    }

    Json(json!({ "cached": false, "streamUrl": null }))
}

// 9. GET & POST /api/track-analysis
pub async fn handle_get_track_analysis(Query(q): Query<IdQuery>) -> Json<Value> {
    let clean_id = clean_track_id(q.id.as_deref().unwrap_or(""));
    let meta_path = get_metadata_path();
    if !clean_id.is_empty() && meta_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&meta_path) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, Value>>(&content) {
                if let Some(entry) = map.get(&clean_id) {
                    return Json(json!({ "success": true, "analysis": entry.get("analysis") }));
                }
            }
        }
    }
    Json(json!({ "success": true, "analysis": null }))
}

pub async fn handle_post_track_analysis(Json(payload): Json<Value>) -> Json<Value> {
    let id = clean_track_id(payload["id"].as_str().unwrap_or(""));
    if !id.is_empty() {
        let meta_path = get_metadata_path();
        let mut map: HashMap<String, Value> = if meta_path.exists() {
            std::fs::read_to_string(&meta_path)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok())
                .unwrap_or_default()
        } else {
            HashMap::new()
        };

        let entry = map.entry(id).or_insert_with(|| json!({}));
        if let Some(obj) = entry.as_object_mut() {
            if let Some(analysis) = payload.get("analysis") {
                obj.insert("analysis".to_string(), analysis.clone());
            }
        }

        if let Ok(serialized) = serde_json::to_string_pretty(&map) {
            let _ = std::fs::write(&meta_path, serialized);
        }
    }
    Json(json!({ "success": true }))
}

// 10. GET /api/local-thumbnail
pub async fn handle_local_thumbnail(Query(q): Query<IdQuery>) -> Response {
    let clean_id = clean_track_id(q.id.as_deref().unwrap_or(""));
    if !clean_id.is_empty() {
        let p = get_thumbnails_dir().join(format!("{}.jpg", clean_id));
        if p.exists() {
            if let Ok(bytes) = tokio::fs::read(&p).await {
                return (
                    [
                        (header::CONTENT_TYPE, "image/jpeg"),
                        (header::CACHE_CONTROL, "public, max-age=31536000"),
                    ],
                    bytes,
                )
                    .into_response();
            }
        }
    }
    (StatusCode::NOT_FOUND, "Thumbnail not found").into_response()
}

// 11. GET /api/local-track
pub async fn handle_local_track(Query(q): Query<IdQuery>, headers: HeaderMap) -> Response {
    let clean_id = clean_track_id(q.id.as_deref().unwrap_or(""));
    if clean_id.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing track id").into_response();
    }

    let cache_dir = get_cache_dir();
    let mut target_path = None;
    for ext in &["opus", "webm", "m4a", "mp3", "wav", "flac"] {
        let p = cache_dir.join(format!("{}.{}", clean_id, ext));
        if p.exists() {
            target_path = Some(p);
            break;
        }
    }

    let path = match target_path {
        Some(p) => p,
        None => return (StatusCode::NOT_FOUND, "Track file not found").into_response(),
    };

    let total_len = match tokio::fs::metadata(&path).await {
        Ok(m) => m.len(),
        Err(_) => return (StatusCode::NOT_FOUND, "File metadata error").into_response(),
    };

    let mime = match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "opus" => "audio/ogg",
        "webm" => "audio/webm",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "wav" => "audio/wav",
        _ => "audio/webm",
    };

    // Range header support for seeking
    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    if let Some(range_str) = range {
        if let Some(spec) = range_str.strip_prefix("bytes=") {
            let parts: Vec<&str> = spec.split('-').collect();
            let start: u64 = parts[0].parse().unwrap_or(0);
            let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                parts[1].parse().unwrap_or(total_len - 1)
            } else {
                total_len - 1
            };

            let end = end.min(total_len - 1);
            let chunk_len = if end >= start { end - start + 1 } else { 0 };

            if let Ok(mut file) = tokio::fs::File::open(&path).await {
                use tokio::io::{AsyncReadExt, AsyncSeekExt};
                let _ = file.seek(std::io::SeekFrom::Start(start)).await;
                let mut buffer = vec![0u8; chunk_len as usize];
                if file.read_exact(&mut buffer).await.is_ok() {
                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::CONTENT_TYPE, mime)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, total_len))
                        .header(header::CONTENT_LENGTH, chunk_len.to_string())
                        .body(Body::from(buffer))
                        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Stream error").into_response());
                }
            }
        }
    }

    if let Ok(bytes) = tokio::fs::read(&path).await {
        (
            [
                (header::CONTENT_TYPE, mime),
                (header::ACCEPT_RANGES, "bytes"),
                (header::CONTENT_LENGTH, total_len.to_string().as_str()),
            ],
            bytes,
        )
            .into_response()
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read track").into_response()
    }
}

// 12. POST /api/save-custom-lyrics
pub async fn handle_save_custom_lyrics(Query(q): Query<IdQuery>, Json(payload): Json<Value>) -> Json<Value> {
    let title = q.title.as_deref().unwrap_or("").trim();
    let artist = q.artist.as_deref().unwrap_or("").trim();
    if !title.is_empty() {
        let key = format!("{}_{}", clean_track_id(artist), clean_track_id(title));
        let path = get_custom_lyrics_dir().join(format!("{}.json", key));
        if let Ok(serialized) = serde_json::to_string_pretty(&payload) {
            let _ = std::fs::write(path, serialized);
        }
    }
    Json(json!({ "success": true }))
}

// 13. POST /api/vibe
pub async fn handle_vibe(
    State(artist_service): State<super::artist::ArtistService>,
    Json(payload): Json<Value>,
) -> Json<Value> {
    let limit = payload["limit"].as_u64().unwrap_or(12).clamp(4, 30) as usize;
    let tracks = artist_service.fetch_charts(limit).await;
    Json(json!({ "success": true, "tracks": tracks }))
}

// 14. GET & POST /api/prefetch
pub async fn handle_prefetch() -> Json<Value> {
    Json(json!({ "success": true }))
}

// 15. GET /api/tools-status
pub async fn handle_tools_status() -> Json<Value> {
    let has_ytdlp = check_binary("yt-dlp");
    let has_ffmpeg = check_binary("ffmpeg");
    Json(json!({
        "ytDlp": has_ytdlp,
        "ffmpeg": has_ffmpeg,
        "progress": {
            "status": "idle",
            "tool": "",
            "percent": 100,
            "error": ""
        }
    }))
}

// 16. POST /api/tools-install
pub async fn handle_tools_install() -> Json<Value> {
    Json(json!({ "started": true }))
}

fn check_binary(name: &str) -> bool {
    let dirs = std::env::var("PATH").unwrap_or_default();
    let split_char = if cfg!(windows) { ';' } else { ':' };
    for dir in dirs.split(split_char) {
        let p = Path::new(dir).join(name);
        if p.exists() {
            return true;
        }
    }
    false
}

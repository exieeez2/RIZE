use axum::{extract::Query, response::Json};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ImportQuery {
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportTrackItem {
    pub title: String,
    pub artist: String,
    pub duration: u64,
    pub cover: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResponse {
    pub success: bool,
    pub name: String,
    pub tracks: Vec<ImportTrackItem>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct ImportService {
    client: reqwest::Client,
}

impl ImportService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    pub async fn import_yandex(&self, raw_url: &str) -> Option<ImportResponse> {
        let ym_track_re = Regex::new(r"music\.yandex\.[a-z]+/album/(\d+)/track/(\d+)").unwrap();
        let ym_album_re = Regex::new(r"music\.yandex\.[a-z]+/album/(\d+)").unwrap();
        let ym_playlist_re = Regex::new(r"music\.yandex\.[a-z]+/users/([^/]+)/playlists/(\d+)").unwrap();

        if let Some(caps) = ym_track_re.captures(raw_url) {
            let track_id = caps.get(2)?.as_str();
            let api_url = format!("https://music.yandex.ru/handlers/track.jsx?track={}", track_id);
            let res = self.client.get(&api_url).send().await.ok()?;
            let val: serde_json::Value = res.json().await.ok()?;
            let trk = &val["track"];
            let title = trk["title"].as_str().unwrap_or("Unknown").to_string();
            let mut artists = Vec::new();
            if let Some(arr) = trk["artists"].as_array() {
                for a in arr {
                    if let Some(n) = a["name"].as_str() {
                        artists.push(n.to_string());
                    }
                }
            }
            let artist = if !artists.is_empty() { artists.join(", ") } else { "Unknown Artist".to_string() };
            let duration = trk["durationMs"].as_u64().map(|ms| ms / 1000).unwrap_or(0);
            let cover_uri = trk["coverUri"].as_str().unwrap_or("");
            let cover = if !cover_uri.is_empty() {
                format!("https://{}", cover_uri.replace("%%", "400x400"))
            } else {
                String::new()
            };

            return Some(ImportResponse {
                success: true,
                name: title.clone(),
                tracks: vec![ImportTrackItem { title, artist, duration, cover }],
                error: None,
            });
        }

        if let Some(caps) = ym_album_re.captures(raw_url) {
            let album_id = caps.get(1)?.as_str();
            let api_url = format!("https://music.yandex.ru/handlers/album.jsx?album={}", album_id);
            let res = self.client.get(&api_url).send().await.ok()?;
            let val: serde_json::Value = res.json().await.ok()?;
            let album_title = val["title"].as_str().unwrap_or("Yandex Album").to_string();
            let mut tracks = Vec::new();

            if let Some(volumes) = val["volumes"].as_array() {
                for vol in volumes {
                    if let Some(arr) = vol.as_array() {
                        for trk in arr {
                            let title = trk["title"].as_str().unwrap_or("").to_string();
                            let mut artists = Vec::new();
                            if let Some(a_arr) = trk["artists"].as_array() {
                                for a in a_arr {
                                    if let Some(n) = a["name"].as_str() {
                                        artists.push(n.to_string());
                                    }
                                }
                            }
                            let artist = if !artists.is_empty() { artists.join(", ") } else { "Unknown".to_string() };
                            let duration = trk["durationMs"].as_u64().map(|ms| ms / 1000).unwrap_or(0);
                            let cover_uri = trk["coverUri"].as_str().unwrap_or("");
                            let cover = if !cover_uri.is_empty() {
                                format!("https://{}", cover_uri.replace("%%", "400x400"))
                            } else {
                                String::new()
                            };
                            tracks.push(ImportTrackItem { title, artist, duration, cover });
                        }
                    }
                }
            }

            return Some(ImportResponse {
                success: true,
                name: album_title,
                tracks,
                error: None,
            });
        }

        if let Some(caps) = ym_playlist_re.captures(raw_url) {
            let owner = caps.get(1)?.as_str();
            let kinds = caps.get(2)?.as_str();
            let api_url = format!("https://music.yandex.ru/handlers/playlist.jsx?owner={}&kinds={}", owner, kinds);
            let res = self.client.get(&api_url).send().await.ok()?;
            let val: serde_json::Value = res.json().await.ok()?;
            let playlist_title = val["playlist"]["title"].as_str().unwrap_or("Yandex Playlist").to_string();
            let mut tracks = Vec::new();

            if let Some(arr) = val["playlist"]["tracks"].as_array() {
                for trk in arr {
                    let title = trk["title"].as_str().unwrap_or("").to_string();
                    let mut artists = Vec::new();
                    if let Some(a_arr) = trk["artists"].as_array() {
                        for a in a_arr {
                            if let Some(n) = a["name"].as_str() {
                                artists.push(n.to_string());
                            }
                        }
                    }
                    let artist = if !artists.is_empty() { artists.join(", ") } else { "Unknown".to_string() };
                    let duration = trk["durationMs"].as_u64().map(|ms| ms / 1000).unwrap_or(0);
                    let cover_uri = trk["coverUri"].as_str().unwrap_or("");
                    let cover = if !cover_uri.is_empty() {
                        format!("https://{}", cover_uri.replace("%%", "400x400"))
                    } else {
                        String::new()
                    };
                    tracks.push(ImportTrackItem { title, artist, duration, cover });
                }
            }

            return Some(ImportResponse {
                success: true,
                name: playlist_title,
                tracks,
                error: None,
            });
        }

        None
    }
}

pub async fn handle_import(
    axum::extract::State(service): axum::extract::State<ImportService>,
    Query(q): Query<ImportQuery>,
) -> Json<ImportResponse> {
    let url = q.url.as_deref().unwrap_or("").trim();
    if url.is_empty() {
        return Json(ImportResponse {
            success: false,
            name: String::new(),
            tracks: Vec::new(),
            error: Some("Missing url".to_string()),
        });
    }

    if url.contains("music.yandex") {
        if let Some(resp) = service.import_yandex(url).await {
            return Json(resp);
        }
    }

    Json(ImportResponse {
        success: false,
        name: String::new(),
        tracks: Vec::new(),
        error: Some("Unsupported import URL".to_string()),
    })
}

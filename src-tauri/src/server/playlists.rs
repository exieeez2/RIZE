use axum::extract::Query;
use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistTrack {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub duration: u64,
    #[serde(default)]
    pub cover: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PublicPlaylist {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub cover: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "createdAt", default)]
    pub created_at: u64,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: u64,
    #[serde(default)]
    pub tracks: Vec<PlaylistTrack>,
}

#[derive(Debug, Deserialize)]
pub struct PlaylistQueryParams {
    pub q: Option<String>,
    pub id: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct DeletePlaylistPayload {
    pub id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StatusResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn get_playlists_path() -> PathBuf {
    let data_dir = PathBuf::from("data");
    if !data_dir.exists() {
        let _ = std::fs::create_dir_all(&data_dir);
    }
    data_dir.join("public_playlists.json")
}

fn get_default_playlists() -> Vec<PublicPlaylist> {
    vec![
        PublicPlaylist {
            id: "pub-top-50".to_string(),
            title: "RIZE Топ 50".to_string(),
            author: "RIZE".to_string(),
            cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80".to_string(),
            description: "Главные хиты и популярные треки недели".to_string(),
            created_at: 1700000000000,
            updated_at: 1700000000000,
            tracks: vec![
                PlaylistTrack {
                    id: "t-1".to_string(),
                    title: "Starboy".to_string(),
                    artist: "The Weeknd, Daft Punk".to_string(),
                    duration: 230,
                    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300".to_string(),
                },
                PlaylistTrack {
                    id: "t-2".to_string(),
                    title: "Blinding Lights".to_string(),
                    artist: "The Weeknd".to_string(),
                    duration: 200,
                    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300".to_string(),
                },
            ],
        },
        PublicPlaylist {
            id: "pub-chill-lofi".to_string(),
            title: "Вечерний Chill & Lo-Fi".to_string(),
            author: "Lo-Fi Lounge".to_string(),
            cover: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80".to_string(),
            description: "Спокойная музыка для работы, учебы и отдыха".to_string(),
            created_at: 1700000000000,
            updated_at: 1700000000000,
            tracks: vec![
                PlaylistTrack {
                    id: "c-1".to_string(),
                    title: "Midnight City Beats".to_string(),
                    artist: "Chillhop Music".to_string(),
                    duration: 154,
                    cover: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300".to_string(),
                },
            ],
        },
    ]
}

fn load_playlists() -> Vec<PublicPlaylist> {
    let path = get_playlists_path();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(list) = serde_json::from_str::<Vec<PublicPlaylist>>(&content) {
                if !list.is_empty() {
                    return list;
                }
            }
        }
    }
    let defaults = get_default_playlists();
    let _ = std::fs::write(&path, serde_json::to_string_pretty(&defaults).unwrap_or_default());
    defaults
}

fn save_playlists(list: &[PublicPlaylist]) -> bool {
    let path = get_playlists_path();
    if let Ok(json) = serde_json::to_string_pretty(list) {
        return std::fs::write(path, json).is_ok();
    }
    false
}

pub async fn handle_get_playlists(
    Query(params): Query<PlaylistQueryParams>,
) -> Json<Vec<PublicPlaylist>> {
    let all = load_playlists();
    let limit = params.limit.unwrap_or(50).clamp(1, 100);

    if let Some(ref q) = params.q {
        let q_clean = q.trim().to_lowercase();
        if !q_clean.is_empty() {
            let filtered: Vec<PublicPlaylist> = all
                .into_iter()
                .filter(|p| {
                    p.title.to_lowercase().contains(&q_clean)
                        || p.author.to_lowercase().contains(&q_clean)
                        || p.description.to_lowercase().contains(&q_clean)
                        || p.tracks.iter().any(|t| {
                            t.title.to_lowercase().contains(&q_clean)
                                || t.artist.to_lowercase().contains(&q_clean)
                        })
                })
                .take(limit)
                .collect();
            return Json(filtered);
        }
    }

    Json(all.into_iter().take(limit).collect())
}

pub async fn handle_get_playlist_by_id(
    Query(params): Query<PlaylistQueryParams>,
) -> Result<Json<PublicPlaylist>, (StatusCode, Json<StatusResponse>)> {
    let id = params.id.unwrap_or_default().trim().to_string();
    if id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(StatusResponse {
                ok: false,
                error: Some("Missing id parameter".to_string()),
            }),
        ));
    }

    let all = load_playlists();
    if let Some(found) = all.into_iter().find(|p| p.id == id) {
        Ok(Json(found))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(StatusResponse {
                ok: false,
                error: Some("Playlist not found".to_string()),
            }),
        ))
    }
}

pub async fn handle_publish_playlists(
    Json(payload): Json<PublicPlaylist>,
) -> Result<Json<StatusResponse>, (StatusCode, Json<StatusResponse>)> {
    if payload.id.trim().is_empty() || payload.title.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(StatusResponse {
                ok: false,
                error: Some("Missing playlist id or title".to_string()),
            }),
        ));
    }

    let mut all = load_playlists();
    if let Some(pos) = all.iter().position(|p| p.id == payload.id) {
        all[pos] = payload;
    } else {
        all.insert(0, payload);
    }

    if save_playlists(&all) {
        Ok(Json(StatusResponse { ok: true, error: None }))
    } else {
        Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(StatusResponse {
                ok: false,
                error: Some("Failed to save playlist".to_string()),
            }),
        ))
    }
}

pub async fn handle_delete_playlist(
    Json(payload): Json<DeletePlaylistPayload>,
) -> Result<Json<StatusResponse>, (StatusCode, Json<StatusResponse>)> {
    let id = payload.id.unwrap_or_default().trim().to_string();
    if id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(StatusResponse {
                ok: false,
                error: Some("Missing id parameter".to_string()),
            }),
        ));
    }

    let mut all = load_playlists();
    let initial_len = all.len();
    all.retain(|p| p.id != id);

    if all.len() < initial_len {
        save_playlists(&all);
        Ok(Json(StatusResponse { ok: true, error: None }))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(StatusResponse {
                ok: false,
                error: Some("Playlist not found".to_string()),
            }),
        ))
    }
}

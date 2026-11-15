use axum::{extract::Query, response::Json};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub limit: Option<usize>,
    pub engine: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub duration: u64,
    pub cover: String,
    pub thumbnail: String,
    pub url: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub success: bool,
    pub tracks: Vec<SearchTrack>,
}

#[derive(Clone)]
pub struct SearchService {
    client: reqwest::Client,
}

impl SearchService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    pub fn extract_featuring(title: &str, base_artist: &str) -> String {
        let mut artist_str = base_artist.trim().to_string();
        let feat_regex = Regex::new(r"(?i)[\(\[](?:feat\.|ft\.|featuring)\s+([^\)\]]+)[\)\]]").unwrap();
        if let Some(caps) = feat_regex.captures(title) {
            if let Some(m) = caps.get(1) {
                let parts: Vec<&str> = m.as_str().split([',', '&', '+']).map(|s| s.trim()).filter(|s| s.len() >= 2).collect();
                let mut existing: Vec<String> = artist_str.split(',').map(|s| s.trim().to_lowercase()).collect();
                for f in parts {
                    if !existing.iter().any(|e| e == &f.to_lowercase()) {
                        if !artist_str.is_empty() {
                            artist_str.push_str(", ");
                        }
                        artist_str.push_str(f);
                        existing.push(f.to_lowercase());
                    }
                }
            }
        }
        if artist_str.is_empty() {
            "Unknown Artist".to_string()
        } else {
            artist_str
        }
    }

    pub async fn search_youtube(&self, query: &str, limit: usize) -> Vec<SearchTrack> {
        let body = serde_json::json!({
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20241021.01.00",
                    "hl": "ru",
                    "gl": "RU"
                }
            },
            "query": format!("{} music", query.trim())
        });

        let resp = match self.client
            .post("https://www.youtube.com/youtubei/v1/search")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => return Vec::new(),
        };

        let val: serde_json::Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => return Vec::new(),
        };

        let mut tracks = Vec::new();
        let items = val["contents"]["twoColumnSearchResultsRenderer"]["primaryContents"]["sectionListRenderer"]["contents"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|item| item["itemSectionRenderer"]["contents"].as_array());

        if let Some(items) = items {
            for item in items {
                if tracks.len() >= limit {
                    break;
                }
                let vr = &item["videoRenderer"];
                if vr.is_null() {
                    continue;
                }

                let video_id = match vr["videoId"].as_str() {
                    Some(id) if !id.is_empty() => id.to_string(),
                    _ => continue,
                };

                let title = vr["title"]["runs"]
                    .as_array()
                    .and_then(|runs| runs.first())
                    .and_then(|r| r["text"].as_str())
                    .or_else(|| vr["title"]["simpleText"].as_str())
                    .unwrap_or("Unknown")
                    .to_string();

                let base_artist = vr["ownerText"]["runs"]
                    .as_array()
                    .and_then(|runs| runs.first())
                    .and_then(|r| r["text"].as_str())
                    .or_else(|| {
                        vr["shortBylineText"]["runs"]
                            .as_array()
                            .and_then(|runs| runs.first())
                            .and_then(|r| r["text"].as_str())
                    })
                    .unwrap_or("Unknown Artist");

                let artist = Self::extract_featuring(&title, base_artist);

                let duration_sec = vr["lengthText"]["simpleText"]
                    .as_str()
                    .or_else(|| vr["lengthText"]["runs"].as_array().and_then(|a| a.first()).and_then(|r| r["text"].as_str()))
                    .map(|d_str| {
                        let parts: Vec<&str> = d_str.split(':').collect();
                        if parts.len() == 2 {
                            let m: u64 = parts[0].parse().unwrap_or(0);
                            let s: u64 = parts[1].parse().unwrap_or(0);
                            m * 60 + s
                        } else if parts.len() == 3 {
                            let h: u64 = parts[0].parse().unwrap_or(0);
                            let m: u64 = parts[1].parse().unwrap_or(0);
                            let s: u64 = parts[2].parse().unwrap_or(0);
                            h * 3600 + m * 60 + s
                        } else {
                            0
                        }
                    })
                    .unwrap_or(0);

                let cover = format!("https://img.youtube.com/vi/{}/hqdefault.jpg", video_id);

                tracks.push(SearchTrack {
                    id: video_id.clone(),
                    title,
                    artist,
                    duration: duration_sec,
                    cover: cover.clone(),
                    thumbnail: cover,
                    url: format!("/api/audio?id={}", video_id),
                    platform: "youtube".to_string(),
                });
            }
        }

        tracks
    }

    pub fn get_demo_catalog(&self, limit: usize) -> Vec<SearchTrack> {
        let demos = vec![
            ("demo-01", "Неоновый дождь", "The Weeknd", 26),
            ("demo-02", "Полночный экспресс", "Кино", 24),
            ("demo-03", "Моя волна", "Oliver Tree", 28),
            ("demo-04", "Хрустальное утро", "Billie Eilish", 26),
            ("demo-05", "Городские огни", "XXXTENTACION", 25),
            ("demo-06", "Тёплый шум", "Steve Lacy", 27),
            ("demo-07", "Пыль на виниле", "Panchiko", 24),
            ("demo-08", "Последний троллейбус", "Конец Солнечных Дней", 26),
        ];

        demos.into_iter().take(limit).map(|(id, title, artist, dur)| {
            SearchTrack {
                id: id.to_string(),
                title: title.to_string(),
                artist: artist.to_string(),
                duration: dur,
                cover: format!("/api/demo-cover?id={}", id),
                thumbnail: format!("/api/demo-cover?id={}", id),
                url: format!("/api/demo-audio?id={}", id),
                platform: "demo".to_string(),
            }
        }).collect()
    }

    pub async fn search(&self, q: &str, limit: usize) -> Vec<SearchTrack> {
        let tracks = self.search_youtube(q, limit).await;
        if tracks.is_empty() {
            self.get_demo_catalog(limit)
        } else {
            tracks
        }
    }
}

pub async fn handle_search(
    axum::extract::State(service): axum::extract::State<SearchService>,
    Query(q): Query<SearchQuery>,
) -> Json<SearchResponse> {
    let query_str = q.q.as_deref().unwrap_or("").trim();
    let limit = q.limit.unwrap_or(25).clamp(1, 50);

    if query_str.is_empty() {
        return Json(SearchResponse {
            success: false,
            tracks: Vec::new(),
        });
    }

    let tracks = service.search(query_str, limit).await;
    Json(SearchResponse {
        success: true,
        tracks,
    })
}

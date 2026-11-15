use axum::{extract::Query, response::Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Deserialize)]
pub struct LyricsQuery {
    pub track: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResponse {
    pub success: bool,
    #[serde(rename = "syncedLyrics")]
    pub synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    pub plain_lyrics: Option<String>,
    pub track: String,
    pub artist: String,
}

#[derive(Debug, Deserialize)]
struct LrclibResponse {
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

#[derive(Clone)]
pub struct LyricsService {
    client: reqwest::Client,
    cache: Arc<RwLock<HashMap<String, LyricsResponse>>>,
}

impl LyricsService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(6))
            .user_agent("RIZE/1.3.0 (Linux; x86_64)")
            .build()
            .unwrap_or_default();
        Self {
            client,
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn clean_string(s: &str) -> String {
        let mut text = s.trim().to_string();
        let junk_patterns = [
            "(Official Video)", "(Official Music Video)", "(Official Audio)",
            "[Official Video]", "[Official Music Video]", "[Official Audio]",
            "(Lyric Video)", "[Lyric Video]", "(Lyrics)", "[Lyrics]",
            "(Audio)", "[Audio]", "(Visualizer)", "[Visualizer]",
            "(Clip)", "[Clip]", "(HD)", "[HD]", "(HQ)", "[HQ]",
            "(Remix)", "[Remix]", "(Slowed + Reverb)", "[Slowed + Reverb]",
            " - Topic", " -- Topic"
        ];
        for pat in junk_patterns {
            let lower_pat = pat.to_lowercase();
            while let Some(pos) = text.to_lowercase().find(&lower_pat) {
                text.replace_range(pos..pos + pat.len(), "");
            }
        }
        text.trim().to_string()
    }

    pub async fn fetch_lyrics(&self, q: LyricsQuery) -> LyricsResponse {
        let raw_track = q.track.as_deref().or(q.title.as_deref()).unwrap_or("").trim();
        let raw_artist = q.artist.as_deref().unwrap_or("").trim().to_string();

        if raw_track.is_empty() {
            return LyricsResponse {
                success: false,
                synced_lyrics: None,
                plain_lyrics: None,
                track: raw_track.to_string(),
                artist: raw_artist,
            };
        }

        let cache_key = format!("{}|{}", raw_track.to_lowercase(), raw_artist.to_lowercase());
        if let Ok(c) = self.cache.read() {
            if let Some(cached) = c.get(&cache_key) {
                return cached.clone();
            }
        }

        // Clean featuring tokens and video junk from title
        let mut clean_track = Self::clean_string(raw_track);
        let mut clean_artist = Self::clean_string(&raw_artist);

        if clean_artist.is_empty() && clean_track.contains(" - ") {
            let parts: Vec<&str> = clean_track.splitn(2, " - ").collect();
            if parts.len() == 2 {
                clean_artist = parts[0].trim().to_string();
                clean_track = parts[1].trim().to_string();
            }
        }

        // 1. Direct GET request to LRCLIB
        let mut get_url = format!(
            "https://lrclib.net/api/get?track_name={}&artist_name={}",
            urlencoding::encode(&clean_track),
            urlencoding::encode(&clean_artist)
        );
        if let Some(dur) = q.duration {
            if dur > 0.0 {
                get_url.push_str(&format!("&duration={}", dur.round() as u64));
            }
        }

        if let Ok(res) = self.client.get(&get_url).send().await {
            if res.status().is_success() {
                if let Ok(data) = res.json::<LrclibResponse>().await {
                    let has_synced = data.synced_lyrics.as_ref().map_or(false, |s| !s.trim().is_empty());
                    let has_plain = data.plain_lyrics.as_ref().map_or(false, |s| !s.trim().is_empty());
                    if has_synced || has_plain {
                        let result = LyricsResponse {
                            success: true,
                            synced_lyrics: data.synced_lyrics,
                            plain_lyrics: data.plain_lyrics,
                            track: raw_track.to_string(),
                            artist: raw_artist.to_string(),
                        };
                        if let Ok(mut c) = self.cache.write() {
                            c.insert(cache_key, result.clone());
                        }
                        return result;
                    }
                }
            }
        }

        // 2. Search fallback
        let search_url = format!(
            "https://lrclib.net/api/search?q={}",
            urlencoding::encode(&format!("{} {}", clean_artist, clean_track).trim())
        );

        if let Ok(res) = self.client.get(&search_url).send().await {
            if res.status().is_success() {
                if let Ok(items) = res.json::<Vec<LrclibResponse>>().await {
                    for item in items {
                        let has_synced = item.synced_lyrics.as_ref().map_or(false, |s| !s.trim().is_empty());
                        let has_plain = item.plain_lyrics.as_ref().map_or(false, |s| !s.trim().is_empty());
                        if has_synced || has_plain {
                            let result = LyricsResponse {
                                success: true,
                                synced_lyrics: item.synced_lyrics,
                                plain_lyrics: item.plain_lyrics,
                                track: raw_track.to_string(),
                                artist: raw_artist.to_string(),
                            };
                            if let Ok(mut c) = self.cache.write() {
                                c.insert(cache_key, result.clone());
                            }
                            return result;
                        }
                    }
                }
            }
        }

        LyricsResponse {
            success: false,
            synced_lyrics: None,
            plain_lyrics: None,
            track: raw_track.to_string(),
            artist: raw_artist.to_string(),
        }
    }
}

pub async fn handle_lyrics(
    axum::extract::State(service): axum::extract::State<LyricsService>,
    Query(q): Query<LyricsQuery>,
) -> Json<LyricsResponse> {
    let resp = service.fetch_lyrics(q).await;
    Json(resp)
}

#[derive(Debug, Deserialize)]
pub struct TranslatePayload {
    pub texts: Option<Vec<String>>,
    pub lines: Option<Vec<String>>,
    #[serde(rename = "targetLang")]
    pub target_lang: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TranslateResponse {
    pub success: bool,
    pub translations: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn handle_translate(
    axum::extract::State(service): axum::extract::State<LyricsService>,
    Json(payload): Json<TranslatePayload>,
) -> Json<TranslateResponse> {
    let raw_list = payload.texts.or(payload.lines).unwrap_or_default();
    if raw_list.is_empty() {
        return Json(TranslateResponse {
            success: true,
            translations: Vec::new(),
            error: None,
        });
    }

    let target_lang = payload
        .target_lang
        .or(payload.to)
        .unwrap_or_else(|| "ru".to_string());

    // Batch lines into chunks of up to 1200 chars
    let mut chunks: Vec<Vec<String>> = Vec::new();
    let mut cur_chunk: Vec<String> = Vec::new();
    let mut cur_len = 0;

    for line in &raw_list {
        let s = line.trim().to_string();
        if !cur_chunk.is_empty() && cur_len + s.len() + 1 > 1200 {
            chunks.push(cur_chunk);
            cur_chunk = Vec::new();
            cur_len = 0;
        }
        cur_len += s.len() + 1;
        cur_chunk.push(s);
    }
    if !cur_chunk.is_empty() {
        chunks.push(cur_chunk);
    }

    let mut results: Vec<String> = Vec::new();

    for chunk in chunks {
        let query = chunk.join("\n");
        let url = format!(
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={}&dt=t&q={}",
            urlencoding::encode(&target_lang),
            urlencoding::encode(&query)
        );

        let mut success = false;
        if let Ok(resp) = service.client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(json_val) = resp.json::<serde_json::Value>().await {
                    if let Some(arr0) = json_val.get(0).and_then(|v| v.as_array()) {
                        let mut joined = String::new();
                        for item in arr0 {
                            if let Some(s) = item.get(0).and_then(|v| v.as_str()) {
                                joined.push_str(s);
                            }
                        }
                        let split_lines: Vec<&str> = joined.lines().collect();
                        for i in 0..chunk.len() {
                            if let Some(trans) = split_lines.get(i) {
                                results.push(trans.trim().to_string());
                            } else {
                                results.push(chunk[i].clone());
                            }
                        }
                        success = true;
                    }
                }
            }
        }

        if !success {
            results.extend(chunk);
        }
    }

    Json(TranslateResponse {
        success: true,
        translations: results,
        error: None,
    })
}


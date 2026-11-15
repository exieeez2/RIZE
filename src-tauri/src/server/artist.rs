use axum::{extract::Query, response::Json};
use regex::Regex;
use serde::{Deserialize, Serialize};

use super::search::SearchService;

#[derive(Debug, Deserialize)]
pub struct ArtistQuery {
    pub name: Option<String>,
    pub id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub duration: u64,
    pub cover: String,
    pub rank: u64,
    pub plays: u64,
    pub album: String,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistAlbum {
    pub id: u64,
    pub title: String,
    pub cover: String,
    #[serde(rename = "releaseDate")]
    pub release_date: String,
    #[serde(rename = "recordType")]
    pub record_type: String,
    #[serde(rename = "trackCount")]
    pub track_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatedArtist {
    pub id: u64,
    pub name: String,
    pub picture: String,
    #[serde(rename = "nbFan")]
    pub nb_fan: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistDetails {
    pub id: u64,
    pub name: String,
    pub picture: String,
    #[serde(rename = "pictureMedium")]
    pub picture_medium: String,
    #[serde(rename = "nbFan")]
    pub nb_fan: u64,
    #[serde(rename = "monthlyListeners")]
    pub monthly_listeners: u64,
    #[serde(rename = "trackCount")]
    pub track_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistData {
    pub name: String,
    pub avatar: String,
    #[serde(rename = "isVerified")]
    pub is_verified: bool,
    pub tracks: Vec<ArtistTrack>,
    pub albums: Vec<ArtistAlbum>,
    pub singles: Vec<ArtistAlbum>,
    pub related: Vec<RelatedArtist>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistResponse {
    pub success: bool,
    pub id: u64,
    pub name: String,
    pub artist: String,
    pub picture: String,
    #[serde(rename = "pictureMedium")]
    pub picture_medium: String,
    #[serde(rename = "nbFan")]
    pub nb_fan: u64,
    #[serde(rename = "monthlyListeners")]
    pub monthly_listeners: u64,
    #[serde(rename = "trackCount")]
    pub track_count: u64,
    pub tracks: Vec<ArtistTrack>,
    pub albums: Vec<ArtistAlbum>,
    pub singles: Vec<ArtistAlbum>,
    pub similar: Vec<RelatedArtist>,
    #[serde(rename = "relatedArtists")]
    pub related_artists: Vec<RelatedArtist>,
    #[serde(rename = "artistDetails")]
    pub artist_details: Option<ArtistDetails>,
    #[serde(rename = "artistData")]
    pub artist_data: Option<ArtistData>,
}

// Candidate scoring & matching algorithm for accurate artist search
fn clean_simple_string(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn transliterate_cyrillic_to_latin(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        let lower = c.to_lowercase().next().unwrap_or(c);
        match lower {
            'а' => out.push('a'), 'б' => out.push('b'), 'в' => out.push('v'),
            'г' => out.push('g'), 'д' => out.push('d'), 'е' | 'ё' => out.push('e'),
            'ж' => out.push_str("zh"), 'з' => out.push('z'), 'и' | 'й' => out.push('i'),
            'к' => out.push('k'), 'л' => out.push('l'), 'м' => out.push('m'),
            'н' => out.push('n'), 'о' => out.push('o'), 'п' => out.push('p'),
            'р' => out.push('r'), 'с' => out.push('s'), 'т' => out.push('t'),
            'у' => out.push('u'), 'ф' => out.push('f'), 'х' => out.push('h'),
            'ц' => out.push_str("ts"), 'ч' => out.push_str("ch"),
            'ш' => out.push_str("sh"), 'щ' => out.push_str("sch"),
            'ы' => out.push('y'), 'э' => out.push('e'), 'ю' => out.push_str("yu"),
            'я' => out.push_str("ya"),
            other => out.push(other),
        }
    }
    out
}

fn normalize_artist_string(s: &str) -> String {
    let mut res = String::with_capacity(s.len());
    for c in s.chars() {
        let lower = c.to_lowercase().next().unwrap_or(c);
        match lower {
            '1' | '!' => res.push('i'),
            '0' => res.push('o'),
            '3' => res.push('e'),
            '4' | '@' => res.push('a'),
            '$' => res.push('s'),
            'c' | 'k' => res.push('k'),
            '-' | '_' | '.' | ',' | '\'' | '"' | '(' | ')' | '[' | ']' => res.push(' '),
            other if other.is_alphanumeric() || other.is_whitespace() => res.push(other),
            _ => {}
        }
    }
    res.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn score_artist_candidate(candidate_name: &str, query: &str, nb_fan: u64) -> u32 {
    let c_raw = clean_simple_string(candidate_name);
    let q_raw = clean_simple_string(query);
    if c_raw.is_empty() || q_raw.is_empty() {
        return 0;
    }

    let c_leet = normalize_artist_string(candidate_name);
    let q_leet = normalize_artist_string(query);

    let q_translit = clean_simple_string(&transliterate_cyrillic_to_latin(query));
    let c_translit = clean_simple_string(&transliterate_cyrillic_to_latin(candidate_name));

    let mut score = 0u32;

    // Exact equality
    if c_raw == q_raw || c_raw == q_translit || c_translit == q_raw {
        score = score.max(100);
    } else if c_leet == q_leet {
        score = score.max(95);
    } else if c_raw.starts_with(&q_raw) || q_raw.starts_with(&c_raw) ||
              c_leet.starts_with(&q_leet) || q_leet.starts_with(&c_leet) {
        score = score.max(80);
    } else {
        // Token overlap
        let c_tokens: Vec<&str> = c_raw.split_whitespace().filter(|t| t.len() >= 2).collect();
        let q_tokens: Vec<&str> = q_raw.split_whitespace().filter(|t| t.len() >= 2).collect();
        let common_count = c_tokens.iter().filter(|t| q_tokens.contains(t)).count();
        if common_count > 0 {
            score = score.max(50 + (common_count as u32) * 15);
        } else if c_raw.contains(&q_raw) || q_raw.contains(&c_raw) ||
                  c_leet.contains(&q_leet) || q_leet.contains(&c_leet) {
            score = score.max(30);
        }
    }

    // Only if base score meets minimum threshold of 30, add a small tie-breaking fan bonus (max 10 pts)
    if score >= 30 {
        let fan_bonus = ((nb_fan as f64 / 10000.0).min(10.0)) as u32;
        score += fan_bonus;
    }

    score
}

fn is_deezer_placeholder_avatar(url: &str) -> bool {
    url.contains("1a93a1a317e2383aeae098261b38bc38") || url.trim().is_empty()
}

#[derive(Clone)]
pub struct ArtistService {
    client: reqwest::Client,
    search: SearchService,
}

impl ArtistService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .user_agent("RIZE/1.3.0 (Linux; x86_64)")
            .build()
            .unwrap_or_default();
        Self {
            client,
            search: SearchService::new(),
        }
    }

    pub fn new_with_search(search: SearchService) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .user_agent("RIZE/1.3.0 (Linux; x86_64)")
            .build()
            .unwrap_or_default();
        Self { client, search }
    }

    pub fn calculate_monthly_listeners(name: &str, nb_fan: u64) -> u64 {
        if nb_fan == 0 {
            return 0;
        }
        let is_cyrillic = name.chars().any(|c| ('\u{0400}'..='\u{04FF}').contains(&c));
        if is_cyrillic {
            if nb_fan >= 100_000 {
                return (nb_fan * 28 + 800_000).clamp(3_200_000, 8_500_000);
            }
            if nb_fan >= 20_000 {
                return (nb_fan * 135).clamp(2_500_000, 5_500_000);
            }
            if nb_fan >= 5_000 {
                return (nb_fan * 180).clamp(900_000, 2_800_000);
            }
            if nb_fan >= 1_000 {
                return (nb_fan * 220).clamp(220_000, 1_200_000);
            }
            return (nb_fan * 260).max(1_500);
        }

        if nb_fan >= 15_000_000 {
            return (nb_fan * 4 + (nb_fan % 1_000_000) * 2).clamp(82_000_000, 115_000_000);
        }
        if nb_fan >= 8_000_000 {
            return (nb_fan * 8 + (nb_fan % 500_000) * 3).clamp(68_000_000, 95_000_000);
        }
        if nb_fan >= 3_000_000 {
            return (nb_fan * 12).clamp(40_000_000, 72_000_000);
        }
        if nb_fan >= 1_000_000 {
            return (nb_fan * 18).clamp(18_000_000, 42_000_000);
        }
        if nb_fan >= 200_000 {
            return (nb_fan * 26).clamp(5_200_000, 22_000_000);
        }
        if nb_fan >= 20_000 {
            return (nb_fan * 38).clamp(760_000, 6_000_000);
        }
        if nb_fan >= 2_000 {
            return (nb_fan * 48).clamp(96_000, 1_200_000);
        }
        (nb_fan * 75).max(350)
    }

    pub async fn fetch_artist(&self, query_str: &str) -> Option<ArtistResponse> {
        let clean_name = query_str.trim();
        if clean_name.is_empty() {
            return None;
        }

        // 1. Search artist by name on Deezer
        let search_url = format!(
            "https://api.deezer.com/search/artist?q={}&limit=10",
            urlencoding::encode(clean_name)
        );
        let resp = self.client.get(&search_url).send().await.ok()?;
        let data: serde_json::Value = resp.json().await.ok()?;

        let mut artist_id_opt = None;
        let mut artist_name_opt = None;
        let mut nb_fan_opt = None;
        let mut picture_opt = None;
        let mut picture_medium_opt = None;
        let mut best_score_val = 0u32;

        let pick_best_artist = |arr: &[serde_json::Value], target: &str| -> Option<(serde_json::Value, u32)> {
            let mut top_score = 0u32;
            let mut top_cand: Option<serde_json::Value> = None;
            for a in arr {
                let name = a["name"].as_str().unwrap_or_default();
                let fans = a["nb_fan"].as_u64().unwrap_or(0);
                let score = score_artist_candidate(name, target, fans);
                if score >= 30 && score > top_score {
                    top_score = score;
                    top_cand = Some(a.clone());
                }
            }
            top_cand.map(|cand| (cand, top_score))
        };

        if let Some(arr) = data["data"].as_array() {
            if let Some((best, score)) = pick_best_artist(arr, clean_name) {
                artist_id_opt = best["id"].as_u64();
                artist_name_opt = best["name"].as_str().map(|s| s.to_string());
                nb_fan_opt = best["nb_fan"].as_u64();
                picture_opt = best["picture_xl"]
                    .as_str()
                    .or_else(|| best["picture_big"].as_str())
                    .or_else(|| best["picture_medium"].as_str())
                    .map(|s| s.to_string());
                picture_medium_opt = best["picture_medium"].as_str().map(|s| s.to_string());
                best_score_val = score;
            }
        }

        if artist_id_opt.is_none() && (clean_name.contains(',') || clean_name.contains('&')) {
            let primary = clean_name.split([',', '&']).next().unwrap_or(clean_name).trim();
            let sub_search = format!(
                "https://api.deezer.com/search/artist?q={}&limit=10",
                urlencoding::encode(primary)
            );
            if let Ok(sub_res) = self.client.get(&sub_search).send().await {
                if let Ok(sub_data) = sub_res.json::<serde_json::Value>().await {
                    if let Some(arr) = sub_data["data"].as_array() {
                        if let Some((best, score)) = pick_best_artist(arr, primary) {
                            artist_id_opt = best["id"].as_u64();
                            artist_name_opt = best["name"].as_str().map(|s| s.to_string());
                            nb_fan_opt = best["nb_fan"].as_u64();
                            picture_opt = best["picture_xl"]
                                .as_str()
                                .or_else(|| best["picture_big"].as_str())
                                .or_else(|| best["picture_medium"].as_str())
                                .map(|s| s.to_string());
                            picture_medium_opt = best["picture_medium"].as_str().map(|s| s.to_string());
                            best_score_val = score;
                        }
                    }
                }
            }
        }

        let artist_id = match artist_id_opt {
            Some(id) => id,
            None => {
                let yt_tracks = self.search.search_youtube(clean_name, 20).await;
                if !yt_tracks.is_empty() {
                    let mapped_tracks: Vec<ArtistTrack> = yt_tracks.iter().map(|yt| ArtistTrack {
                        id: yt.id.clone(),
                        title: yt.title.clone(),
                        artist: yt.artist.clone(),
                        duration: yt.duration,
                        cover: yt.cover.clone(),
                        rank: 1000,
                        plays: 1000,
                        album: String::new(),
                        preview: String::new(),
                    }).collect();

                    let avatar = mapped_tracks.first().map(|t| t.cover.clone()).unwrap_or_default();
                    let data = ArtistData {
                        name: clean_name.to_string(),
                        avatar,
                        is_verified: false,
                        tracks: mapped_tracks.clone(),
                        albums: Vec::new(),
                        singles: Vec::new(),
                        related: Vec::new(),
                    };

                    return Some(ArtistResponse {
                        success: true,
                        id: 0,
                        name: clean_name.to_string(),
                        artist: clean_name.to_string(),
                        picture: String::new(),
                        picture_medium: String::new(),
                        nb_fan: 0,
                        monthly_listeners: 0,
                        track_count: mapped_tracks.len() as u64,
                        tracks: mapped_tracks,
                        albums: Vec::new(),
                        singles: Vec::new(),
                        similar: Vec::new(),
                        related_artists: Vec::new(),
                        artist_details: None,
                        artist_data: Some(data),
                    });
                }
                return None;
            }
        };
        let artist_name = artist_name_opt.unwrap_or_else(|| clean_name.to_string());
        let nb_fan = nb_fan_opt.unwrap_or(0);
        let picture = picture_opt.unwrap_or_default();
        let picture_medium = picture_medium_opt.unwrap_or_default();
        let monthly = Self::calculate_monthly_listeners(&artist_name, nb_fan);

        // Fetch top tracks, albums, and related artists concurrently
        let top_url = format!("https://api.deezer.com/artist/{}/top?limit=40", artist_id);
        let albums_url = format!("https://api.deezer.com/artist/{}/albums?limit=60", artist_id);
        let related_url = format!("https://api.deezer.com/artist/{}/related?limit=16", artist_id);

        let (top_res, albums_res, related_res) = tokio::join!(
            self.client.get(&top_url).send(),
            self.client.get(&albums_url).send(),
            self.client.get(&related_url).send()
        );

        let feat_regex = Regex::new(r"(?i)[\(\[](?:feat\.|ft\.|featuring)\s+([^\)\]]+)[\)\]]").unwrap();

        let mut tracks = Vec::new();
        if let Ok(res) = top_res {
            if let Ok(val) = res.json::<serde_json::Value>().await {
                if let Some(arr) = val["data"].as_array() {
                    for t in arr {
                        let id = t["id"].as_u64().unwrap_or(0);
                        let title = t["title"].as_str().unwrap_or("Unknown").to_string();
                        let mut all_artists = Vec::new();

                        if let Some(main) = t["artist"]["name"].as_str() {
                            all_artists.push(main.to_string());
                        }

                        if let Some(contributors) = t["contributors"].as_array() {
                            for c in contributors {
                                if let Some(n) = c["name"].as_str() {
                                    if !all_artists.iter().any(|a| a.eq_ignore_ascii_case(n)) {
                                        all_artists.push(n.to_string());
                                    }
                                }
                            }
                        }

                        if let Some(caps) = feat_regex.captures(&title) {
                            if let Some(m) = caps.get(1) {
                                for part in m.as_str().split([',', '&', '+']) {
                                    let trimmed = part.trim();
                                    if trimmed.len() >= 2 && !all_artists.iter().any(|a| a.eq_ignore_ascii_case(trimmed)) {
                                        all_artists.push(trimmed.to_string());
                                    }
                                }
                            }
                        }

                        let artist_str = if !all_artists.is_empty() {
                            all_artists.join(", ")
                        } else {
                            artist_name.clone()
                        };

                        let cover = t["album"]["cover_xl"]
                            .as_str()
                            .or_else(|| t["album"]["cover_big"].as_str())
                            .or_else(|| t["album"]["cover_medium"].as_str())
                            .unwrap_or("")
                            .to_string();

                        tracks.push(ArtistTrack {
                            id: format!("dz_{}", id),
                            title,
                            artist: artist_str,
                            duration: t["duration"].as_u64().unwrap_or(0),
                            cover,
                            rank: t["rank"].as_u64().unwrap_or(0),
                            plays: t["rank"].as_u64().unwrap_or(0),
                            album: t["album"]["title"].as_str().unwrap_or("").to_string(),
                            preview: t["preview"].as_str().unwrap_or("").to_string(),
                        });
                    }
                }
            }
        }

        let mut studio_albums = Vec::new();
        let mut singles = Vec::new();

        if let Ok(res) = albums_res {
            if let Ok(val) = res.json::<serde_json::Value>().await {
                if let Some(arr) = val["data"].as_array() {
                    for a in arr {
                        let id = a["id"].as_u64().unwrap_or(0);
                        let title = a["title"].as_str().unwrap_or("").to_string();
                        let cover = a["cover_xl"]
                            .as_str()
                            .or_else(|| a["cover_big"].as_str())
                            .or_else(|| a["cover_medium"].as_str())
                            .unwrap_or("")
                            .to_string();
                        let release_date = a["release_date"].as_str().unwrap_or("").to_string();
                        let record_type = a["record_type"].as_str().unwrap_or("album").to_lowercase();
                        let track_count = a["nb_tracks"].as_u64().unwrap_or(0);

                        let album_item = ArtistAlbum {
                            id,
                            title,
                            cover,
                            release_date,
                            record_type: record_type.clone(),
                            track_count,
                        };

                        if record_type == "album" {
                            studio_albums.push(album_item);
                        } else {
                            singles.push(album_item);
                        }
                    }
                }
            }
        }

        let mut similar = Vec::new();
        if let Ok(res) = related_res {
            if let Ok(val) = res.json::<serde_json::Value>().await {
                if let Some(arr) = val["data"].as_array() {
                    for r in arr {
                        similar.push(RelatedArtist {
                            id: r["id"].as_u64().unwrap_or(0),
                            name: r["name"].as_str().unwrap_or("").to_string(),
                            picture: r["picture_medium"].as_str().unwrap_or("").to_string(),
                            nb_fan: r["nb_fan"].as_u64().unwrap_or(0),
                        });
                    }
                }
            }
        }

        let is_placeholder = is_deezer_placeholder_avatar(&picture);
        let final_picture = if is_placeholder { String::new() } else { picture.clone() };
        let final_picture_medium = if is_placeholder { String::new() } else { picture_medium.clone() };

        let details = ArtistDetails {
            id: artist_id,
            name: artist_name.clone(),
            picture: final_picture.clone(),
            picture_medium: final_picture_medium.clone(),
            nb_fan,
            monthly_listeners: monthly,
            track_count: tracks.len() as u64,
        };

        let avatar = if !final_picture.is_empty() {
            final_picture.clone()
        } else {
            tracks.first().map(|t| t.cover.clone()).unwrap_or_default()
        };

        let is_verified = !is_placeholder && (nb_fan >= 50 || best_score_val >= 90);

        let artist_data = ArtistData {
            name: artist_name.clone(),
            avatar,
            is_verified,
            tracks: tracks.clone(),
            albums: studio_albums.clone(),
            singles: singles.clone(),
            related: similar.clone(),
        };

        Some(ArtistResponse {
            success: true,
            id: artist_id,
            name: artist_name.clone(),
            artist: artist_name,
            picture: final_picture,
            picture_medium: final_picture_medium,
            nb_fan,
            monthly_listeners: monthly,
            track_count: tracks.len() as u64,
            tracks,
            albums: studio_albums,
            singles,
            similar: similar.clone(),
            related_artists: similar,
            artist_details: Some(details),
            artist_data: Some(artist_data),
        })
    }

    pub async fn fetch_album_tracks(&self, album_id: &str) -> Vec<ArtistTrack> {
        let clean_id = album_id.trim();
        if clean_id.is_empty() {
            return Vec::new();
        }
        let url = format!("https://api.deezer.com/album/{}/tracks?limit=100", clean_id);
        let resp = match self.client.get(&url).send().await {
            Ok(r) => r,
            Err(_) => return Vec::new(),
        };
        let data: serde_json::Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => return Vec::new(),
        };

        let feat_regex = Regex::new(r"(?i)[\(\[](?:feat\.|ft\.|featuring)\s+([^\)\]]+)[\)\]]").unwrap();
        let mut tracks = Vec::new();

        if let Some(arr) = data["data"].as_array() {
            for t in arr {
                let id = t["id"].as_u64().unwrap_or(0);
                let title = t["title"].as_str().unwrap_or("Unknown").to_string();
                let mut all_artists = Vec::new();

                if let Some(main) = t["artist"]["name"].as_str() {
                    all_artists.push(main.to_string());
                }

                if let Some(contributors) = t["contributors"].as_array() {
                    for c in contributors {
                        if let Some(n) = c["name"].as_str() {
                            if !all_artists.iter().any(|a| a.eq_ignore_ascii_case(n)) {
                                all_artists.push(n.to_string());
                            }
                        }
                    }
                }

                if let Some(caps) = feat_regex.captures(&title) {
                    if let Some(m) = caps.get(1) {
                        for part in m.as_str().split([',', '&', '+']) {
                            let trimmed = part.trim();
                            if trimmed.len() >= 2 && !all_artists.iter().any(|a| a.eq_ignore_ascii_case(trimmed)) {
                                all_artists.push(trimmed.to_string());
                            }
                        }
                    }
                }

                let artist_str = if !all_artists.is_empty() {
                    all_artists.join(", ")
                } else {
                    "Unknown".to_string()
                };

                let cover = t["album"]["cover_big"]
                    .as_str()
                    .or_else(|| t["album"]["cover_medium"].as_str())
                    .unwrap_or("")
                    .to_string();

                tracks.push(ArtistTrack {
                    id: format!("dz_{}", id),
                    title,
                    artist: artist_str,
                    duration: t["duration"].as_u64().unwrap_or(0),
                    cover,
                    rank: t["rank"].as_u64().unwrap_or(0),
                    plays: t["rank"].as_u64().unwrap_or(0),
                    album: String::new(),
                    preview: t["preview"].as_str().unwrap_or("").to_string(),
                });
            }
        }
        tracks
    }

    pub async fn fetch_charts(&self, limit: usize) -> Vec<ArtistTrack> {
        let url = format!("https://api.deezer.com/chart/0/tracks?limit={}", limit.clamp(1, 100));
        let resp = match self.client.get(&url).send().await {
            Ok(r) => r,
            Err(_) => return Vec::new(),
        };
        let data: serde_json::Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => return Vec::new(),
        };

        let feat_regex = Regex::new(r"(?i)[\(\[](?:feat\.|ft\.|featuring)\s+([^\)\]]+)[\)\]]").unwrap();
        let mut tracks = Vec::new();

        if let Some(arr) = data["data"].as_array() {
            for t in arr {
                let id = t["id"].as_u64().unwrap_or(0);
                let title = t["title"].as_str().unwrap_or("Unknown").to_string();
                let mut all_artists = Vec::new();

                if let Some(main) = t["artist"]["name"].as_str() {
                    all_artists.push(main.to_string());
                }

                if let Some(contributors) = t["contributors"].as_array() {
                    for c in contributors {
                        if let Some(n) = c["name"].as_str() {
                            if !all_artists.iter().any(|a| a.eq_ignore_ascii_case(n)) {
                                all_artists.push(n.to_string());
                            }
                        }
                    }
                }

                if let Some(caps) = feat_regex.captures(&title) {
                    if let Some(m) = caps.get(1) {
                        for part in m.as_str().split([',', '&', '+']) {
                            let trimmed = part.trim();
                            if trimmed.len() >= 2 && !all_artists.iter().any(|a| a.eq_ignore_ascii_case(trimmed)) {
                                all_artists.push(trimmed.to_string());
                            }
                        }
                    }
                }

                let artist_str = if !all_artists.is_empty() {
                    all_artists.join(", ")
                } else {
                    "Unknown".to_string()
                };

                let cover = t["album"]["cover_big"]
                    .as_str()
                    .or_else(|| t["album"]["cover_medium"].as_str())
                    .unwrap_or("")
                    .to_string();

                tracks.push(ArtistTrack {
                    id: format!("dz_{}", id),
                    title,
                    artist: artist_str,
                    duration: t["duration"].as_u64().unwrap_or(0),
                    cover,
                    rank: t["rank"].as_u64().unwrap_or(0),
                    plays: t["rank"].as_u64().unwrap_or(0),
                    album: t["album"]["title"].as_str().unwrap_or("").to_string(),
                    preview: t["preview"].as_str().unwrap_or("").to_string(),
                });
            }
        }
        tracks
    }
}

#[derive(Debug, Deserialize)]
pub struct AlbumTracksQuery {
    pub id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChartQuery {
    pub limit: Option<usize>,
    pub region: Option<String>,
}

pub async fn handle_artist(
    axum::extract::State(service): axum::extract::State<ArtistService>,
    Query(q): Query<ArtistQuery>,
) -> Json<Option<ArtistResponse>> {
    let name = q.name.as_deref().unwrap_or("").trim();
    if name.is_empty() {
        return Json(None);
    }
    let res = service.fetch_artist(name).await;
    Json(res)
}

pub async fn handle_album_tracks(
    axum::extract::State(service): axum::extract::State<ArtistService>,
    Query(q): Query<AlbumTracksQuery>,
) -> Json<serde_json::Value> {
    let id = q.id.as_deref().unwrap_or("").trim();
    if id.is_empty() {
        return Json(serde_json::json!({ "tracks": [] }));
    }
    let tracks = service.fetch_album_tracks(id).await;
    Json(serde_json::json!({ "tracks": tracks }))
}

pub async fn handle_charts(
    axum::extract::State(service): axum::extract::State<ArtistService>,
    Query(q): Query<ChartQuery>,
) -> Json<serde_json::Value> {
    let limit = q.limit.unwrap_or(30);
    let tracks = service.fetch_charts(limit).await;
    Json(serde_json::json!({ "success": true, "tracks": tracks }))
}

pub async fn handle_recommendations(
    axum::extract::State(service): axum::extract::State<ArtistService>,
    Query(q): Query<ChartQuery>,
) -> Json<serde_json::Value> {
    let limit = q.limit.unwrap_or(30);
    let tracks = service.fetch_charts(limit).await;
    Json(serde_json::json!({ "success": true, "tracks": tracks }))
}

#[derive(Debug, Deserialize)]
pub struct CustomWaveQuery {
    pub seeds: Option<String>,
    #[serde(rename = "trackSeeds")]
    pub track_seeds: Option<String>,
    pub exclude: Option<String>,
    pub limit: Option<usize>,
}

pub async fn handle_custom_wave(
    axum::extract::State(service): axum::extract::State<ArtistService>,
    Query(q): Query<CustomWaveQuery>,
) -> Json<serde_json::Value> {
    let limit = q.limit.unwrap_or(20).clamp(1, 50);
    let mut tracks = Vec::new();

    if let Some(ref s) = q.seeds {
        let artists: Vec<&str> = s.split('|').filter(|x| !x.trim().is_empty()).collect();
        for artist_name in artists.iter().take(4) {
            if let Some(artist_res) = service.fetch_artist(artist_name).await {
                let per_artist = (limit / artists.len().max(1)).max(2);
                for t in artist_res.tracks.into_iter().take(per_artist) {
                    tracks.push(t);
                }
            }
        }
    }

    if tracks.is_empty() {
        tracks = service.fetch_charts(limit).await;
    }

    if let Some(ref exc) = q.exclude {
        let exclude_set: std::collections::HashSet<&str> = exc.split(',').map(|s| s.trim()).collect();
        tracks.retain(|t| !exclude_set.contains(t.id.as_str()));
    }

    tracks.truncate(limit);
    Json(serde_json::json!({
        "success": true,
        "tracks": tracks
    }))
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_score_artist_candidate_accuracy() {
        // Query 'madkid' must favor MADKID / madk1d and strictly reject MadeInParis
        let score_made_in_paris = score_artist_candidate("MadeInParis", "madkid", 74003);
        let score_madkid = score_artist_candidate("MADKID", "madkid", 1643);
        let score_madk1d = score_artist_candidate("madk1d", "madkid", 6159);

        assert_eq!(score_made_in_paris, 0, "MadeInParis must not match madkid");
        assert!(score_madkid >= 100, "MADKID must match madkid with exact score");
        assert!(score_madk1d >= 95, "madk1d must match madkid via leetspeak normalization");
        assert!(score_madk1d > score_made_in_paris);
        assert!(score_madkid > score_made_in_paris);
    }

    #[test]
    fn test_is_deezer_placeholder_avatar() {
        let placeholder = "https://cdn-images.dzcdn.net/images/artist/1a93a1a317e2383aeae098261b38bc38/250x250-000000-80-0-0.jpg";
        let real_avatar = "https://e-cdns-images.dzcdn.net/images/artist/f7e029c786a3eb7995f7000dbcfc4c47/500x500.jpg";

        assert!(is_deezer_placeholder_avatar(placeholder));
        assert!(is_deezer_placeholder_avatar(""));
        assert!(!is_deezer_placeholder_avatar(real_avatar));
    }
}

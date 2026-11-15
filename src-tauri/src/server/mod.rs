pub mod artist;
pub mod auth;
pub mod import;
pub mod library;
pub mod lyrics;
pub mod network;
pub mod playlists;
pub mod search;
pub mod stream;
pub mod sync;

use std::path::PathBuf;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

#[derive(Clone)]
pub struct AppState {
    pub lyrics: lyrics::LyricsService,
    pub artist: artist::ArtistService,
    pub search: search::SearchService,
    pub network: network::NetworkService,
    pub stream: stream::StreamService,
    pub import: import::ImportService,
}

impl axum::extract::FromRef<AppState> for lyrics::LyricsService {
    fn from_ref(state: &AppState) -> Self {
        state.lyrics.clone()
    }
}

impl axum::extract::FromRef<AppState> for artist::ArtistService {
    fn from_ref(state: &AppState) -> Self {
        state.artist.clone()
    }
}

impl axum::extract::FromRef<AppState> for search::SearchService {
    fn from_ref(state: &AppState) -> Self {
        state.search.clone()
    }
}

impl axum::extract::FromRef<AppState> for network::NetworkService {
    fn from_ref(state: &AppState) -> Self {
        state.network.clone()
    }
}

impl axum::extract::FromRef<AppState> for stream::StreamService {
    fn from_ref(state: &AppState) -> Self {
        state.stream.clone()
    }
}

impl axum::extract::FromRef<AppState> for import::ImportService {
    fn from_ref(state: &AppState) -> Self {
        state.import.clone()
    }
}

pub fn find_static_dir() -> PathBuf {
    let candidates = [
        PathBuf::from("src"),
        PathBuf::from("../src"),
        PathBuf::from("../../src"),
    ];
    for c in candidates {
        if c.join("index.html").exists() {
            return c;
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors() {
            let candidate = ancestor.join("src");
            if candidate.join("index.html").exists() {
                return candidate;
            }
        }
    }
    PathBuf::from("src")
}

pub fn create_router() -> axum::Router {
    let search = search::SearchService::new();
    let stream = stream::StreamService::new_with_search(search.clone());
    let state = AppState {
        lyrics: lyrics::LyricsService::new(),
        artist: artist::ArtistService::new_with_search(search.clone()),
        search,
        network: network::NetworkService::new(),
        stream,
        import: import::ImportService::new(),
    };

    let static_dir = find_static_dir();
    let index_file = static_dir.join("index.html");
    let serve_dir = ServeDir::new(&static_dir).fallback(ServeFile::new(index_file));

    axum::Router::new()
        // Auth Endpoints
        .route("/api/auth/google", axum::routing::post(auth::handle_google_auth))
        .route("/api/auth/check-email", axum::routing::post(auth::handle_check_email))
        .route("/api/firebase/config", axum::routing::get(auth::handle_firebase_config))
        // Cross-Platform Shared Sync
        .route(
            "/api/sync/shared-storage",
            axum::routing::get(sync::handle_get_shared_storage).post(sync::handle_post_shared_storage),
        )
        // Public & Community Playlists
        .route("/api/playlists", axum::routing::get(playlists::handle_get_playlists))
        .route("/api/playlists/get", axum::routing::get(playlists::handle_get_playlist_by_id))
        .route("/api/playlists/publish", axum::routing::post(playlists::handle_publish_playlists))
        .route("/api/playlists/delete", axum::routing::post(playlists::handle_delete_playlist))
        // Health & Network Diagnostics
        .route("/api/health", axum::routing::get(network::handle_health))
        .route("/api/network/lan", axum::routing::get(network::handle_lan))
        .route(
            "/api/network/settings",
            axum::routing::get(network::handle_get_settings).post(network::handle_save_settings),
        )
        .route(
            "/api/settings/audio-engine",
            axum::routing::post(network::handle_audio_engine),
        )
        .route(
            "/api/settings/zapret",
            axum::routing::post(network::handle_zapret),
        )
        .route(
            "/api/settings/soundcloud-engine",
            axum::routing::post(network::handle_soundcloud_engine),
        )
        .route(
            "/api/launcher/install",
            axum::routing::get(network::handle_launcher_install)
                .post(network::handle_launcher_install),
        )
        .route("/api/state", axum::routing::post(network::handle_state))
        .route(
            "/api/discord-presence",
            axum::routing::post(network::handle_discord_presence),
        )
        .route(
            "/api/debug-log",
            axum::routing::post(network::handle_debug_log),
        )
        // Music Metadata, Charts & Recommendations
        .route("/api/lyrics", axum::routing::get(lyrics::handle_lyrics))
        .route("/api/translate", axum::routing::post(lyrics::handle_translate))
        .route("/api/artist", axum::routing::get(artist::handle_artist))
        .route(
            "/api/deezer/album-tracks",
            axum::routing::get(artist::handle_album_tracks),
        )
        .route(
            "/api/albums/tracks",
            axum::routing::get(artist::handle_album_tracks),
        )
        .route("/api/charts", axum::routing::get(artist::handle_charts))
        .route("/api/hot", axum::routing::get(artist::handle_charts))
        .route(
            "/api/recommendations",
            axum::routing::get(artist::handle_recommendations),
        )
        .route(
            "/api/custom-wave",
            axum::routing::get(artist::handle_custom_wave),
        )
        // Search & Demo Catalog
        .route("/api/search", axum::routing::get(search::handle_search))
        // Audio Streams & Resolvers
        .route("/api/stream", axum::routing::get(stream::handle_stream))
        .route("/api/audio", axum::routing::get(stream::handle_stream))
        .route(
            "/api/stream-info",
            axum::routing::get(stream::handle_stream_info),
        )
        .route(
            "/api/stream/engine-status",
            axum::routing::get(stream::handle_engine_status),
        )
        .route(
            "/api/audio-output-info",
            axum::routing::get(stream::handle_audio_output_info),
        )
        .route(
            "/api/local-media",
            axum::routing::get(stream::handle_local_media),
        )
        .route(
            "/api/local-file",
            axum::routing::get(stream::handle_local_media),
        )
        // External Import
        .route("/api/import", axum::routing::get(import::handle_import))
        .route(
            "/api/playlist-import",
            axum::routing::get(import::handle_import),
        )
        // Local Library, Offline Storage & Diagnostics
        .route("/api/library", axum::routing::get(library::handle_library))
        .route("/api/library-add", axum::routing::post(library::handle_library_add))
        .route("/api/library-update", axum::routing::post(library::handle_library_update))
        .route("/api/library-remove", axum::routing::post(library::handle_library_remove))
        .route("/api/library-file", axum::routing::get(library::handle_local_track))
        .route("/api/offline-library", axum::routing::get(library::handle_offline_library))
        .route("/api/offline-delete", axum::routing::post(library::handle_offline_delete))
        .route("/api/clear-offline-library", axum::routing::post(library::handle_clear_offline_library))
        .route("/api/check-cache", axum::routing::get(library::handle_check_cache))
        .route(
            "/api/track-analysis",
            axum::routing::get(library::handle_get_track_analysis).post(library::handle_post_track_analysis),
        )
        .route("/api/local-thumbnail", axum::routing::get(library::handle_local_thumbnail))
        .route("/api/local-track", axum::routing::get(library::handle_local_track))
        .route("/api/downloaded-track", axum::routing::get(library::handle_local_track))
        .route("/api/save-custom-lyrics", axum::routing::post(library::handle_save_custom_lyrics))
        .route("/api/vibe", axum::routing::post(library::handle_vibe))
        .route(
            "/api/prefetch",
            axum::routing::get(library::handle_prefetch).post(library::handle_prefetch),
        )
        .route("/api/tools-status", axum::routing::get(library::handle_tools_status))
        .route("/api/tools-install", axum::routing::post(library::handle_tools_install))
        .route("/api/audio-proxy", axum::routing::get(stream::handle_stream))
        .route("/api/lyrics-stream", axum::routing::get(lyrics::handle_lyrics))
        .with_state(state)
        // Static UI Files & Single Page App Fallback
        .fallback_service(serve_dir)
        .layer(CorsLayer::permissive())
}

pub fn start_server(port: u16) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to create Tokio runtime for RIZE native backend");

        rt.block_on(async move {
            let app = create_router();
            let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
            match tokio::net::TcpListener::bind(addr).await {
                Ok(listener) => {
                    println!("[RIZE Native Rust Server] Running at http://127.0.0.1:{}", port);
                    let _ = axum::serve(listener, app).await;
                }
                Err(err) => {
                    eprintln!(
                        "[RIZE Native Rust Server] Could not bind port {}: {}. Node server fallback may be active.",
                        port, err
                    );
                }
            }
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::State;

    #[tokio::test]
    async fn test_health_endpoint() {
        let resp = network::handle_health().await;
        assert!(resp.0.ok);
        assert_eq!(resp.0.name, "RIZE");
        assert_eq!(resp.0.version, "1.3.0");
    }

    #[test]
    fn test_monthly_listeners_calculation() {
        let fans = 50_000;
        let cyrillic_listeners = artist::ArtistService::calculate_monthly_listeners("Miyagi & Эндшпиль", fans);
        assert!(cyrillic_listeners >= 2_500_000, "Cyrillic artist monthly listeners must be scaled: {}", cyrillic_listeners);

        let en_fans = 10_000_000;
        let global_listeners = artist::ArtistService::calculate_monthly_listeners("The Weeknd", en_fans);
        assert!(global_listeners >= 68_000_000, "Global artist monthly listeners must be scaled: {}", global_listeners);
    }

    #[test]
    fn test_search_demo_catalog() {
        let svc = search::SearchService::new();
        let demos = svc.get_demo_catalog(5);
        assert_eq!(demos.len(), 5);
        assert_eq!(demos[0].id, "demo-01");
        assert_eq!(demos[0].platform, "demo");
    }

    #[test]
    fn test_extract_featuring() {
        let feat = search::SearchService::extract_featuring("Wildest Dreams (feat. Kendrick Lamar)", "Taylor Swift");
        assert!(feat.contains("Kendrick Lamar"), "Should extract Kendrick Lamar: {}", feat);
        assert!(feat.contains("Taylor Swift"), "Should retain Taylor Swift: {}", feat);
    }

    #[tokio::test]
    async fn test_network_settings_save_and_read() {
        let svc = network::NetworkService::new();
        let mut settings = network::NetworkSettings::default();
        settings.stream_source = "custom-test".to_string();
        settings.zapret_mode = true;
        let _ = network::handle_save_settings(State(svc.clone()), axum::extract::Json(settings.clone())).await;

        let cur = network::handle_get_settings(State(svc)).await;
        assert_eq!(cur.0.stream_source, "custom-test");
        assert!(cur.0.zapret_mode);
    }

    #[tokio::test]
    async fn test_engine_status_and_audio_output() {
        let engine_status = stream::handle_engine_status().await;
        assert_eq!(engine_status.0.active_engine, "ytdlp-hq");
        assert_eq!(engine_status.0.bitrate, 256);

        let output_info = stream::handle_audio_output_info().await;
        assert_eq!(output_info.0.name, "Системный вывод");
        assert!(!output_info.0.is_bluetooth);
    }

    #[tokio::test]
    async fn test_firebase_config_endpoint() {
        let resp = auth::handle_firebase_config().await;
        assert!(resp.0.ok);
        assert!(resp.0.config.get("apiKey").is_some());
        assert!(resp.0.config.get("projectId").is_some());
    }

    #[tokio::test]
    async fn test_public_playlists_endpoints() {
        let list = playlists::handle_get_playlists(axum::extract::Query(playlists::PlaylistQueryParams {
            q: None,
            id: None,
            limit: Some(10),
        })).await;
        assert!(!list.0.is_empty(), "Default playlists must be loaded");

        let first_id = list.0[0].id.clone();
        let get_one = playlists::handle_get_playlist_by_id(axum::extract::Query(playlists::PlaylistQueryParams {
            q: None,
            id: Some(first_id),
            limit: None,
        })).await;
        assert!(get_one.is_ok(), "Should fetch playlist by id");
    }

    #[tokio::test]
    async fn test_shared_storage_sync() {
        let get_res = sync::handle_get_shared_storage().await;
        assert!(get_res.0.ok);

        let post_res = sync::handle_post_shared_storage(axum::extract::Json(serde_json::json!({
            "test_key": "test_value"
        }))).await;
        assert!(post_res.is_ok());
    }

    #[tokio::test]
    async fn test_custom_wave_endpoint() {
        let search = search::SearchService::new();
        let artist_svc = artist::ArtistService::new_with_search(search);
        let wave_res = artist::handle_custom_wave(
            State(artist_svc),
            axum::extract::Query(artist::CustomWaveQuery {
                seeds: Some("The Weeknd".to_string()),
                track_seeds: None,
                exclude: None,
                limit: Some(5),
            }),
        ).await;
        assert_eq!(wave_res.0["success"], true);
    }

    #[tokio::test]
    async fn test_translate_endpoint() {
        let lyrics_svc = lyrics::LyricsService::new();
        let trans_res = lyrics::handle_translate(
            State(lyrics_svc),
            axum::extract::Json(lyrics::TranslatePayload {
                texts: Some(vec!["Hello".to_string()]),
                lines: None,
                target_lang: Some("ru".to_string()),
                to: None,
            }),
        ).await;
        assert!(trans_res.0.success);
        assert_eq!(trans_res.0.translations.len(), 1);
    }

    #[tokio::test]
    async fn test_library_and_tools_endpoints() {
        let lib_res = library::handle_library().await;
        let _ = lib_res.0.len();

        let offline_res = library::handle_offline_library().await;
        assert!(offline_res.0["tracks"].is_array());

        let cache_res = library::handle_check_cache(axum::extract::Query(library::IdQuery {
            id: Some("test_track_id".to_string()),
            ..Default::default()
        })).await;
        assert_eq!(cache_res.0["cached"], false);

        let tools_res = library::handle_tools_status().await;
        assert!(tools_res.0["ffmpeg"].is_boolean());
    }
}

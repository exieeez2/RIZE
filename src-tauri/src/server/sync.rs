use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct SharedStorageResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn get_shared_storage_path() -> PathBuf {
    let data_dir = PathBuf::from("data");
    if !data_dir.exists() {
        let _ = std::fs::create_dir_all(&data_dir);
    }
    data_dir.join("shared_storage.json")
}

pub async fn handle_get_shared_storage() -> Json<SharedStorageResponse> {
    let path = get_shared_storage_path();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                return Json(SharedStorageResponse {
                    ok: true,
                    data: Some(val),
                    error: None,
                });
            }
        }
    }
    Json(SharedStorageResponse {
        ok: true,
        data: Some(serde_json::json!({})),
        error: None,
    })
}

pub async fn handle_post_shared_storage(
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<SharedStorageResponse>, (StatusCode, Json<SharedStorageResponse>)> {
    let path = get_shared_storage_path();
    let mut current = if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let (Some(cur_map), Some(new_map)) = (current.as_object_mut(), payload.as_object()) {
        for (k, v) in new_map {
            cur_map.insert(k.clone(), v.clone());
        }
    } else {
        current = payload;
    }

    if let Ok(json_str) = serde_json::to_string_pretty(&current) {
        if std::fs::write(&path, json_str).is_ok() {
            return Ok(Json(SharedStorageResponse {
                ok: true,
                data: None,
                error: None,
            }));
        }
    }

    Err((
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(SharedStorageResponse {
            ok: false,
            data: None,
            error: Some("Failed to persist shared storage".to_string()),
        }),
    ))
}

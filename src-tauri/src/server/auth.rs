use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Deserialize)]
pub struct CheckEmailRequest {
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CheckEmailResponse {
    pub exists: bool,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleTokens {
    #[serde(rename = "idToken")]
    pub id_token: String,
    #[serde(rename = "accessToken", skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GoogleAuthResponse {
    pub tokens: GoogleTokens,
}

#[derive(Debug, Deserialize)]
struct FirebaseConfig {
    #[serde(rename = "googleDesktopClientId")]
    google_desktop_client_id: Option<String>,
    #[serde(rename = "googleDesktopClientSecret")]
    google_desktop_client_secret: Option<String>,
}

fn get_google_credentials() -> (String, String) {
    let candidates = [
        PathBuf::from("firebase-config.json"),
        PathBuf::from("../firebase-config.json"),
        PathBuf::from("../../firebase-config.json"),
    ];

    for path in &candidates {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<FirebaseConfig>(&content) {
                    let client_id = config.google_desktop_client_id.unwrap_or_default().trim().to_string();
                    let client_secret = config.google_desktop_client_secret.unwrap_or_default().trim().to_string();
                    if !client_id.is_empty() {
                        return (client_id, client_secret);
                    }
                }
            }
        }
    }

    // Fallback credentials from environment or defaults
    (
        std::env::var("GOOGLE_CLIENT_ID")
            .unwrap_or_else(|_| "283427548411-sau4cogsh1vpd2k9rns9i9f1vbatikm0.apps.googleusercontent.com".to_string()),
        std::env::var("GOOGLE_CLIENT_SECRET")
            .unwrap_or_default(),
    )
}

fn generate_random_string(len: usize) -> String {
    use std::time::SystemTime;
    let seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(123456789);

    let charset = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut state = seed;
    let mut res = String::with_capacity(len);
    for i in 0..len {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407 + i as u128);
        let idx = ((state >> 64) as usize) % charset.len();
        res.push(charset[idx] as char);
    }
    res
}

fn base64url_encode(data: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut result = String::new();
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i] as usize;
        let b1 = if i + 1 < data.len() { data[i + 1] as usize } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] as usize } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARSET[(triple >> 18) & 0x3F] as char);
        result.push(CHARSET[(triple >> 12) & 0x3F] as char);

        if i + 1 < data.len() {
            result.push(CHARSET[(triple >> 6) & 0x3F] as char);
        }
        if i + 2 < data.len() {
            result.push(CHARSET[triple & 0x3F] as char);
        }

        i += 3;
    }
    result
}

fn open_browser(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", url])
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Ok(_) = std::process::Command::new("xdg-open").arg(url).spawn() {
            return Ok(());
        }
        if let Ok(_) = std::process::Command::new("gio").args(["open", url]).spawn() {
            return Ok(());
        }
        if let Ok(browser) = std::env::var("BROWSER") {
            let _ = std::process::Command::new(browser).arg(url).spawn();
        }
    }
    Ok(())
}

fn html_response(success: bool, message: &str) -> String {
    let title = if success { "Вход выполнен" } else { "Не удалось войти" };
    let color = if success { "#1ed760" } else { "#ff6b6b" };
    let icon = if success { "✓" } else { "!" };

    let body = format!(
        r#"<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{} — RIZE</title>
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #101114;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }}
    .card {{
      width: min(420px, calc(100% - 48px));
      padding: 36px 32px;
      border: 1px solid #2a2d34;
      border-radius: 24px;
      background: #181a1f;
      text-align: center;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6);
    }}
    .mark {{
      width: 56px;
      height: 56px;
      margin: 0 auto 20px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: {};
      color: #101114;
      font-size: 28px;
      font-weight: 800;
    }}
    h1 {{ margin: 0 0 12px; font-size: 24px; font-weight: 700; }}
    p {{ margin: 0; color: #a4a7b0; font-size: 15px; line-height: 1.5; }}
  </style>
</head>
<body>
  <main class="card">
    <div class="mark">{}</div>
    <h1>{}</h1>
    <p>{}</p>
  </main>
</body>
</html>"#,
        title, color, icon, title, message
    );

    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body
    )
}

pub async fn handle_check_email(
    Json(payload): Json<CheckEmailRequest>,
) -> Json<CheckEmailResponse> {
    let email = payload.email.unwrap_or_default().trim().to_lowercase();
    if email.is_empty() {
        return Json(CheckEmailResponse { exists: false });
    }

    // Check users.json if present
    let users_paths = [
        PathBuf::from("users.json"),
        PathBuf::from("../users.json"),
        PathBuf::from("../../users.json"),
    ];

    for p in &users_paths {
        if p.exists() {
            if let Ok(content) = std::fs::read_to_string(p) {
                if let Ok(users) = serde_json::from_str::<Vec<serde_json::Value>>(&content) {
                    let exists = users.iter().any(|u| {
                        u["email"].as_str().map(|e| e.to_lowercase()) == Some(email.clone())
                    });
                    return Json(CheckEmailResponse { exists });
                }
            }
        }
    }

    Json(CheckEmailResponse { exists: false })
}

pub async fn handle_google_auth() -> Result<Json<GoogleAuthResponse>, (StatusCode, Json<ErrorResponse>)> {
    let (client_id, client_secret) = get_google_credentials();
    if client_id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Google Desktop Client ID не настроен в firebase-config.json".to_string(),
            }),
        ));
    }

    // Bind local ephemeral listener
    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(l) => l,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Не удалось запустить локальный сервер авторизации: {}", e),
                }),
            ));
        }
    };

    let local_addr = match listener.local_addr() {
        Ok(a) => a,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Не удалось определить порт: {}", e),
                }),
            ));
        }
    };

    let redirect_uri = format!("http://127.0.0.1:{}/oauth/google/callback", local_addr.port());

    // Generate PKCE
    let verifier = generate_random_string(64);
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    let challenge = base64url_encode(&hash);
    let state = generate_random_string(32);

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&state={}&code_challenge={}&code_challenge_method=S256&prompt=select_account",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&state),
        urlencoding::encode(&challenge),
    );

    if let Err(e) = open_browser(&auth_url) {
        eprintln!("[Google OAuth] Failed to open browser: {}", e);
    }

    // Wait for callback with timeout of 5 minutes
    let timeout = Duration::from_secs(300);
    let auth_result = tokio::time::timeout(timeout, async {
        let (mut socket, _) = listener.accept().await.map_err(|e| e.to_string())?;
        let mut buf = [0u8; 4096];
        let n = socket.read(&mut buf).await.map_err(|e| e.to_string())?;
        let req_str = String::from_utf8_lossy(&buf[..n]);

        let first_line = req_str.lines().next().unwrap_or("");
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() < 2 {
            let resp = html_response(false, "Некорректный запрос от браузера.");
            let _ = socket.write_all(resp.as_bytes()).await;
            return Err("Некорректный HTTP запрос".to_string());
        }

        let path_and_query = parts[1];
        let url = match url::Url::parse(&format!("http://127.0.0.1{}", path_and_query)) {
            Ok(u) => u,
            Err(_) => {
                let resp = html_response(false, "Не удалось разобрать URL ответа.");
                let _ = socket.write_all(resp.as_bytes()).await;
                return Err("Ошибка парсинга URL".to_string());
            }
        };

        let params: HashMap<String, String> = url.query_pairs().into_owned().collect();

        if let Some(err) = params.get("error") {
            let msg = if err == "access_denied" {
                "Вход был отменён в браузере."
            } else {
                "Google вернул ошибку авторизации."
            };
            let resp = html_response(false, msg);
            let _ = socket.write_all(resp.as_bytes()).await;
            return Err(msg.to_string());
        }

        let returned_state = params.get("state").cloned().unwrap_or_default();
        if returned_state != state {
            let resp = html_response(false, "Защитный код запроса не совпал. Вернитесь в RIZE.");
            let _ = socket.write_all(resp.as_bytes()).await;
            return Err("State mismatch".to_string());
        }

        let code = match params.get("code") {
            Some(c) if !c.is_empty() => c.clone(),
            _ => {
                let resp = html_response(false, "Код подтверждения не найден.");
                let _ = socket.write_all(resp.as_bytes()).await;
                return Err("Missing code parameter".to_string());
            }
        };

        // Write success to browser
        let resp = html_response(true, "Вернитесь в приложение RIZE — аккаунт успешно подключён.");
        let _ = socket.write_all(resp.as_bytes()).await;
        let _ = socket.flush().await;

        Ok(code)
    })
    .await;

    let code = match auth_result {
        Ok(Ok(c)) => c,
        Ok(Err(msg)) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse { error: msg }),
            ));
        }
        Err(_) => {
            return Err((
                StatusCode::REQUEST_TIMEOUT,
                Json(ErrorResponse {
                    error: "Время ожидания входа через Google истекло".to_string(),
                }),
            ));
        }
    };

    // Exchange authorization code for tokens
    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    let mut form_params = vec![
        ("client_id", client_id.clone()),
        ("code", code),
        ("code_verifier", verifier),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code".to_string()),
    ];
    if !client_secret.is_empty() {
        form_params.push(("client_secret", client_secret));
    }

    let token_resp = match http_client
        .post("https://oauth2.googleapis.com/token")
        .form(&form_params)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("Не удалось связаться с сервером Google: {}", e),
                }),
            ));
        }
    };

    let token_json: serde_json::Value = match token_resp.json().await {
        Ok(j) => j,
        Err(e) => {
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("Некорректный ответ от Google OAuth: {}", e),
                }),
            ));
        }
    };

    let id_token = match token_json["id_token"].as_str() {
        Some(t) if !t.is_empty() => t.to_string(),
        _ => {
            let err_desc = token_json["error_description"]
                .as_str()
                .or_else(|| token_json["error"].as_str())
                .unwrap_or("Google не вернул ID token");
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: err_desc.to_string(),
                }),
            ));
        }
    };

    let access_token = token_json["access_token"].as_str().map(|s| s.to_string());

    Ok(Json(GoogleAuthResponse {
        tokens: GoogleTokens {
            id_token,
            access_token,
        },
    }))
}

#[derive(Debug, Serialize)]
pub struct FirebaseConfigResponse {
    pub ok: bool,
    pub config: serde_json::Value,
}

pub async fn handle_firebase_config() -> Json<FirebaseConfigResponse> {
    let candidates = [
        PathBuf::from("firebase-config.json"),
        PathBuf::from("../firebase-config.json"),
        PathBuf::from("../../firebase-config.json"),
    ];

    for path in &candidates {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                    return Json(FirebaseConfigResponse { ok: true, config });
                }
            }
        }
    }

    let default_config = serde_json::json!({
        "apiKey": "AIzaSyBSRslJWfFlpgX3Sm3_RbXEILtj2PL0A-k",
        "authDomain": "votify-f461a.firebaseapp.com",
        "projectId": "votify-f461a",
        "storageBucket": "votify-f461a.firebasestorage.app",
        "messagingSenderId": "283427548411",
        "appId": "1:283427548411:web:dc7c5cfa55240448d6d45e",
        "googleDesktopClientId": "283427548411-sau4cogsh1vpd2k9rns9i9f1vbatikm0.apps.googleusercontent.com",
        "googleDesktopClientSecret": std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default()
    });

    Json(FirebaseConfigResponse {
        ok: true,
        config: default_config,
    })
}


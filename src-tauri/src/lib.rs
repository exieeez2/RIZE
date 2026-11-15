use std::net::TcpStream;
use std::thread;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

pub mod server;

fn ensure_server() {
    let addr = "127.0.0.1:17217";
    if TcpStream::connect(addr).is_ok() {
        return;
    }

    // Launch native Rust backend server (Axum)
    server::start_server(17217);

    for _ in 0..60 {
        thread::sleep(Duration::from_millis(50));
        if TcpStream::connect(addr).is_ok() {
            return;
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    unsafe {
        std::env::set_var("GTK_THEME", "Adwaita:dark");
        std::env::set_var("WEBKIT_FORCE_COMPOSITING_MODE", "1");
    }
    ensure_server();

    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::utils::config::Color(18, 18, 20, 255)));
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System Tray setup
            let show_item = MenuItem::with_id(app, "show", "Открыть RIZE", true, None::<&str>)?;
            let play_item = MenuItem::with_id(app, "play_pause", "Воспроизведение / Пауза", true, None::<&str>)?;
            let next_item = MenuItem::with_id(app, "next", "Следующий трек", true, None::<&str>)?;
            let prev_item = MenuItem::with_id(app, "prev", "Предыдущий трек", true, None::<&str>)?;
            let sep = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &play_item, &next_item, &prev_item, &sep, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .tooltip("RIZE")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "play_pause" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval("if (typeof window.handlePlayerAction === 'function') window.handlePlayerAction('play-pause'); else if (typeof window.togglePlayPause === 'function') window.togglePlayPause();");
                        }
                    }
                    "next" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval("if (typeof window.handlePlayerAction === 'function') window.handlePlayerAction('next'); else if (typeof window.playNext === 'function') window.playNext();");
                        }
                    }
                    "prev" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval("if (typeof window.handlePlayerAction === 'function') window.handlePlayerAction('prev'); else if (typeof window.playPrev === 'function') window.playPrev();");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(visible) = window.is_visible() {
                                if visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let _ = tray_builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

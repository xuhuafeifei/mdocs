use std::sync::Mutex;

use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use url::Url;

mod url_util;
use url_util::{
    clipboard_doc_target, is_shell_setup_url, normalize_server_url, origin_key, same_doc_target,
};

struct ShellState {
    server_url: Mutex<Option<String>>,
    setup_url: Mutex<Option<Url>>,
    last_clipboard: Mutex<Option<String>>,
}

fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("server.json"))
}

fn read_saved_url(app: &AppHandle) -> Option<String> {
    let path = config_path(app).ok()?;
    let text = std::fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    v.get("url")?
        .as_str()
        .map(str::to_string)
        .filter(|s| !s.is_empty())
}

fn write_saved_url(app: &AppHandle, url: &str) -> Result<(), String> {
    let path = config_path(app)?;
    let body = serde_json::json!({ "url": url });
    std::fs::write(
        path,
        serde_json::to_vec_pretty(&body).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

fn open_in_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

fn origin_of_server(server: &str) -> Option<String> {
    origin_key(&Url::parse(server).ok()?)
}

fn is_downloadable_asset(url: &Url) -> bool {
    let path = url.path();
    if !path.contains("/api/assets/") {
        return false;
    }
    let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    !matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" | "bmp" | "jfif" | "pjpeg"
    )
}

fn navigation_allowed(url: &Url, server: Option<&str>) -> bool {
    if url.scheme() == "about" || is_shell_setup_url(url) {
        return true;
    }
    if url.scheme() != "http" && url.scheme() != "https" {
        return false;
    }
    let Some(server) = server else {
        return false;
    };
    match (origin_key(url), origin_of_server(server)) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

#[tauri::command]
fn saved_server_url(app: AppHandle) -> Option<String> {
    app.state::<ShellState>()
        .server_url
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .or_else(|| read_saved_url(&app))
}

#[tauri::command]
fn save_server_url(app: AppHandle, url: String) -> Result<String, String> {
    let normalized =
        normalize_server_url(&url).ok_or_else(|| "请填写 http(s) 地址或 host:端口".to_string())?;
    write_saved_url(&app, &normalized)?;
    if let Ok(mut g) = app.state::<ShellState>().server_url.lock() {
        *g = Some(normalized.clone());
    }
    let parsed = Url::parse(&normalized).map_err(|e| e.to_string())?;
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "no window".to_string())?;
    window.navigate(parsed).map_err(|e| e.to_string())?;
    Ok(normalized)
}

fn try_clipboard_jump(window: &WebviewWindow) {
    let app = window.app_handle();
    let state = app.state::<ShellState>();
    let server = match state.server_url.lock() {
        Ok(g) => g.clone(),
        Err(_) => return,
    };
    let Some(server) = server else {
        return;
    };
    let mut clipboard = match arboard::Clipboard::new() {
        Ok(c) => c,
        Err(_) => return,
    };
    let text = match clipboard.get_text() {
        Ok(t) if !t.trim().is_empty() => t,
        _ => return,
    };
    let Some(target) = clipboard_doc_target(&text, &server) else {
        return;
    };
    {
        let mut last = match state.last_clipboard.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if last.as_deref() == Some(text.as_str()) {
            return;
        }
        *last = Some(text);
    }
    let current = window.url().map(|u| u.to_string()).unwrap_or_default();
    if same_doc_target(&current, &target) {
        return;
    }
    if let Ok(parsed) = Url::parse(&target) {
        let _ = window.navigate(parsed);
    }
}

fn go_setup(app: &AppHandle) {
    let setup = app
        .state::<ShellState>()
        .setup_url
        .lock()
        .ok()
        .and_then(|g| g.clone());
    let Some(setup) = setup else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.navigate(setup);
}

fn refresh(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.reload();
    }
}

fn attach_window_handlers(window: &WebviewWindow) {
    let w = window.clone();
    let _ = window.on_window_event(move |event| {
        if let WindowEvent::Focused(true) = event {
            try_clipboard_jump(&w);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let saved = read_saved_url(app.handle());
            app.manage(ShellState {
                server_url: Mutex::new(saved.clone()),
                setup_url: Mutex::new(None),
                last_clipboard: Mutex::new(None),
            });

            let handle_nav = app.handle().clone();
            let handle_dl = app.handle().clone();

            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("mdocs")
                .inner_size(1280.0, 800.0)
                .min_inner_size(720.0, 480.0)
                .decorations(true)
                // 关掉 wry 的原生拖放处理：否则文件拖入会被原生层吞掉，只发一个
                // 没人监听的 Tauri DragDropEvent，网页侧 HTML5 drop 永远不触发
                //（表现为「拖文件到文章里没反应、不上传」）。
                // 编辑器自带 UploadPlugin 已在网页侧处理 drop → handleUpload。
                .disable_drag_drop_handler()
                .on_new_window({
                    let handle_nw = handle_nav.clone();
                    move |url, _features| {
                        // 附件卡片是 target=_blank。不接这个回调时 wry 直接拒绝新窗口，点击无反应。
                        let server = handle_nw
                            .state::<ShellState>()
                            .server_url
                            .lock()
                            .ok()
                            .and_then(|g| g.clone());
                        if is_downloadable_asset(&url) || navigation_allowed(&url, server.as_deref()) {
                            if let Some(window) = handle_nw.get_webview_window("main") {
                                let js = format!(
                                    "window.location.assign({})",
                                    serde_json::to_string(url.as_str()).unwrap_or_else(|_| "\"\"".into())
                                );
                                let _ = window.eval(js);
                            }
                        } else if url.scheme() == "http" || url.scheme() == "https" {
                            open_in_browser(url.as_str());
                        }
                        NewWindowResponse::Deny
                    }
                })
                .on_navigation(move |url| {
                    let server = handle_nav
                        .state::<ShellState>()
                        .server_url
                        .lock()
                        .ok()
                        .and_then(|g| g.clone());
                    if navigation_allowed(url, server.as_deref()) {
                        return true;
                    }
                    if url.scheme() == "http" || url.scheme() == "https" {
                        open_in_browser(url.as_str());
                    }
                    false
                })
                .on_download(move |_webview, event| {
                    if let DownloadEvent::Requested { destination, .. } = event {
                        if let Ok(dir) = handle_dl.path().download_dir() {
                            let name = destination
                                .file_name()
                                .map(|s| s.to_os_string())
                                .unwrap_or_else(|| "download".into());
                            *destination = dir.join(name);
                        }
                    }
                    true
                })
                .build()?;

            if let Ok(url) = window.url() {
                if let Ok(mut g) = window.app_handle().state::<ShellState>().setup_url.lock() {
                    *g = Some(url);
                }
            }
            if let Some(server) = saved {
                if let Ok(parsed) = Url::parse(&server) {
                    let _ = window.navigate(parsed);
                }
            }
            attach_window_handlers(&window);

            #[cfg(target_os = "macos")]
            {
                let app_menu = SubmenuBuilder::new(app, "mdocs")
                    .text("change-server", "更换服务器")
                    .text("refresh", "刷新")
                    .separator()
                    .quit()
                    .build()?;
                let edit_menu = SubmenuBuilder::new(app, "编辑")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                let menu = MenuBuilder::new(app)
                    .item(&app_menu)
                    .item(&edit_menu)
                    .build()?;
                app.set_menu(menu)?;
            }
            #[cfg(not(target_os = "macos"))]
            {
                let menu = MenuBuilder::new(app)
                    .text("change-server", "更换服务器")
                    .text("refresh", "刷新")
                    .build()?;
                window.set_menu(menu)?;
            }

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "change-server" => go_setup(app),
            "refresh" => refresh(app),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![save_server_url, saved_server_url])
        .run(tauri::generate_context!())
        .expect("error while running mdocs desktop");
}

use url::Url;

/// trim；无 scheme 则补 `http://`；仅允许 http(s) 且有 host。
pub fn normalize_server_url(raw: &str) -> Option<String> {
    let mut text = raw.trim().to_string();
    if text.is_empty() {
        return None;
    }
    if !text.contains("://") {
        text = format!("http://{text}");
    }
    let parsed = Url::parse(&text).ok()?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return None;
    }
    if parsed.host_str().unwrap_or("").is_empty() {
        return None;
    }
    Some(text)
}

pub fn origin_key(url: &Url) -> Option<String> {
    let scheme = url.scheme();
    if scheme != "http" && scheme != "https" {
        return None;
    }
    let host = url.host_str()?.to_ascii_lowercase();
    let default_port: u16 = if scheme == "https" { 443 } else { 80 };
    let port = url.port_or_known_default().unwrap_or(default_port);
    if port == default_port {
        Some(format!("{scheme}://{host}"))
    } else {
        Some(format!("{scheme}://{host}:{port}"))
    }
}

fn doc_id_from_route(route: &str) -> Option<String> {
    let trimmed = route.trim().trim_matches('/');
    let mut parts = trimmed.split('/');
    match (parts.next(), parts.next(), parts.next()) {
        (Some("doc"), Some(id), None) if !id.is_empty() => Some(id.to_string()),
        _ => None,
    }
}

pub fn extract_doc_id(url: &Url) -> Option<String> {
    if let Some(fragment) = url.fragment() {
        if let Some(id) = doc_id_from_route(fragment) {
            return Some(id);
        }
    }
    doc_id_from_route(url.path())
}

fn find_http_url(text: &str) -> Option<&str> {
    let hay = text.trim();
    let lower = hay.to_ascii_lowercase();
    let start = match (lower.find("http://"), lower.find("https://")) {
        (Some(a), Some(b)) => a.min(b),
        (Some(a), None) => a,
        (None, Some(b)) => b,
        _ => return None,
    };
    let rest = &hay[start..];
    let end = rest
        .find(|c: char| c.is_whitespace() || matches!(c, '<' | '>' | '"' | '\''))
        .unwrap_or(rest.len());
    Some(
        rest[..end].trim_end_matches(|c: char| {
            matches!(c, '.' | ',' | ';' | ')' | ']' | '>' | '」' | '』')
        }),
    )
}

/// 剪贴板里若有与已配置服务器同源、且带 /doc/<id> 的链接，返回应打开的 Hash 地址。
pub fn clipboard_doc_target(clipboard: &str, configured_server: &str) -> Option<String> {
    let configured = Url::parse(configured_server.trim()).ok()?;
    let want = origin_key(&configured)?;
    let raw = find_http_url(clipboard)?;
    let uri = Url::parse(raw).ok()?;
    if origin_key(&uri)? != want {
        return None;
    }
    let doc_id = extract_doc_id(&uri)?;
    Some(format!("{want}/#/doc/{doc_id}"))
}

pub fn same_doc_target(current_url: &str, target_url: &str) -> bool {
    let a = Url::parse(current_url).ok().and_then(|u| extract_doc_id(&u));
    let b = Url::parse(target_url).ok().and_then(|u| extract_doc_id(&u));
    match (a, b) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

pub fn is_shell_setup_url(url: &Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_adds_http_and_rejects_bad() {
        assert_eq!(
            normalize_server_url("192.168.1.8:4000").as_deref(),
            Some("http://192.168.1.8:4000")
        );
        assert_eq!(
            normalize_server_url("https://docs.example.com").as_deref(),
            Some("https://docs.example.com")
        );
        assert!(normalize_server_url("").is_none());
        assert!(normalize_server_url("ftp://x").is_none());
        assert!(normalize_server_url("http://").is_none());
    }

    #[test]
    fn clipboard_same_origin_hash_and_path() {
        let server = "http://www.fgbg.top:4000";
        assert_eq!(
            clipboard_doc_target("http://www.fgbg.top:4000/#/doc/abc", server).as_deref(),
            Some("http://www.fgbg.top:4000/#/doc/abc")
        );
        assert_eq!(
            clipboard_doc_target("see http://www.fgbg.top:4000/doc/abc please", server).as_deref(),
            Some("http://www.fgbg.top:4000/#/doc/abc")
        );
        assert!(clipboard_doc_target("https://other.example/doc/abc", server).is_none());
        assert!(clipboard_doc_target("http://www.fgbg.top:4000/", server).is_none());
    }

    #[test]
    fn origin_ignores_default_port() {
        let a = Url::parse("https://x.example").unwrap();
        let b = Url::parse("https://x.example:443/foo").unwrap();
        assert_eq!(origin_key(&a), origin_key(&b));
    }

    #[test]
    fn setup_url_is_not_localhost_with_port() {
        let setup = Url::parse("tauri://localhost/").unwrap();
        let win_setup = Url::parse("https://tauri.localhost/").unwrap();
        let mdocs = Url::parse("http://localhost:4000/").unwrap();
        assert!(is_shell_setup_url(&setup));
        assert!(is_shell_setup_url(&win_setup));
        assert!(!is_shell_setup_url(&mdocs));
    }
}

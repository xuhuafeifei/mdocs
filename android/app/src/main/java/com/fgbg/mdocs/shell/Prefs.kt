package com.fgbg.mdocs.shell

import android.content.Context
import android.net.Uri

private const val PREFS = "mdocs_shell"
private const val KEY_URL = "server_url"

object Prefs {
    fun getUrl(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_URL, null)
            ?.takeIf { it.isNotBlank() }

    fun setUrl(context: Context, url: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_URL, url)
            .apply()
    }
}

/** trim；无 scheme 则补 http://；仅允许 http(s) 且有 host。 */
fun normalizeServerUrl(raw: String): String? {
    var text = raw.trim()
    if (text.isEmpty()) return null
    if (!text.contains("://")) {
        text = "http://$text"
    }
    val uri = Uri.parse(text)
    val scheme = uri.scheme?.lowercase()
    if (scheme != "http" && scheme != "https") return null
    if (uri.host.isNullOrBlank()) return null
    return text
}

private val URL_IN_TEXT = Regex("""https?://[^\s<>"']+""", RegexOption.IGNORE_CASE)
private val DOC_ROUTE = Regex("""^/?doc/([^/]+)/?$""")

fun originKey(uri: Uri): String? {
    val scheme = uri.scheme?.lowercase() ?: return null
    val host = uri.host?.lowercase() ?: return null
    if (scheme != "http" && scheme != "https") return null
    val defaultPort = if (scheme == "https") 443 else 80
    val port = if (uri.port == -1) defaultPort else uri.port
    return if (port == defaultPort) "$scheme://$host" else "$scheme://$host:$port"
}

fun extractDocId(uri: Uri): String? {
    val fromHash = uri.fragment?.let { DOC_ROUTE.find(it.trim()) }?.groupValues?.getOrNull(1)
    if (!fromHash.isNullOrBlank()) return fromHash
    return DOC_ROUTE.find(uri.path.orEmpty())?.groupValues?.getOrNull(1)
}

/**
 * 剪贴板里若有与已配置服务器同源、且带 /doc/<id> 的链接，返回应打开的 Hash 地址。
 */
fun clipboardDocTarget(clipboard: String, configuredServer: String): String? {
    val configured = Uri.parse(configuredServer.trim())
    val want = originKey(configured) ?: return null
    val match = URL_IN_TEXT.find(clipboard.trim()) ?: return null
    val raw = match.value.trimEnd('.', ',', ';', ')', ']', '>', '」', '』')
    val uri = Uri.parse(raw)
    if (originKey(uri) != want) return null
    val docId = extractDocId(uri) ?: return null
    return "$want/#/doc/$docId"
}

fun sameDocTarget(currentUrl: String, targetUrl: String): Boolean {
    val a = extractDocId(Uri.parse(currentUrl)) ?: return false
    val b = extractDocId(Uri.parse(targetUrl)) ?: return false
    return a == b
}

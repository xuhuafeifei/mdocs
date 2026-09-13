package com.fgbg.mdocs.shell

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.URLUtil
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var allowedHost: String? = null
    private var configuredServer: String = ""
    private var lastHandledClipboard: String? = null

    private val fileChooser =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris = if (result.resultCode == RESULT_OK) {
                val data = result.data
                when {
                    data?.clipData != null -> {
                        val clip = data.clipData!!
                        Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                    }
                    data?.data != null -> arrayOf(data.data!!)
                    else -> null
                }
            } else {
                null
            }
            filePathCallback?.onReceiveValue(uris)
            filePathCallback = null
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = Prefs.getUrl(this)
        if (url.isNullOrBlank()) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }
        configuredServer = url

        setContentView(R.layout.activity_main)

        allowedHost = Uri.parse(url).host
        webView = findViewById(R.id.webview)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }
        webView.webViewClient = ShellWebViewClient()
        webView.webChromeClient = ShellChromeClient()
        webView.setDownloadListener { downloadUrl, userAgent, contentDisposition, mimeType, _ ->
            val request = DownloadManager.Request(Uri.parse(downloadUrl))
            request.setMimeType(mimeType)
            request.addRequestHeader("User-Agent", userAgent)
            val cookie = CookieManager.getInstance().getCookie(downloadUrl)
            if (!cookie.isNullOrBlank()) {
                request.addRequestHeader("Cookie", cookie)
            }
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
            )
            val name = URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType)
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, getString(R.string.download_started, name), Toast.LENGTH_SHORT).show()
        }
        webView.loadUrl(url)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus || !::webView.isInitialized) return
        val target = clipboardDocUrl() ?: return
        if (sameDocTarget(webView.url.orEmpty(), target)) return
        webView.loadUrl(target)
    }

    private fun clipboardText(): String? {
        return try {
            val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            val item = cm.primaryClip?.getItemAt(0) ?: return null
            item.coerceToText(this)?.toString()?.takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }

    private fun clipboardDocUrl(): String? {
        val clip = clipboardText() ?: return null
        val target = clipboardDocTarget(clip, configuredServer) ?: return null
        if (clip == lastHandledClipboard) return null
        lastHandledClipboard = clip
        return target
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }

    private inner class ShellWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            val scheme = uri.scheme?.lowercase()
            if (scheme != "http" && scheme != "https") {
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: ActivityNotFoundException) {
                    true
                }
            }
            if (uri.host != null && uri.host != allowedHost) {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            }
            return false
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            AlertDialog.Builder(this@MainActivity)
                .setMessage(R.string.ssl_untrusted)
                .setPositiveButton(R.string.ssl_continue) { _, _ -> handler.proceed() }
                .setNegativeButton(R.string.cancel) { _, _ -> handler.cancel() }
                .setOnCancelListener { handler.cancel() }
                .show()
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            if (request.isForMainFrame) {
                Toast.makeText(this@MainActivity, R.string.load_error, Toast.LENGTH_LONG).show()
            }
        }
    }

    private inner class ShellChromeClient : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            callback: ValueCallback<Array<Uri>>,
            params: FileChooserParams,
        ): Boolean {
            filePathCallback?.onReceiveValue(null)
            filePathCallback = callback
            return try {
                fileChooser.launch(params.createIntent())
                true
            } catch (_: ActivityNotFoundException) {
                filePathCallback = null
                callback.onReceiveValue(null)
                false
            }
        }
    }
}
